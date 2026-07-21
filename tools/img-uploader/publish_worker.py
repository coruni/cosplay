"""端到端发布流程：解压 → 清理 → 规范化 → 重打包 → 压缩上传 → 发布。"""
from __future__ import annotations
from pathlib import Path

from PyQt5.QtCore import QThread, pyqtSignal

from config import AppConfig
from uploader import upload_image
from gallery_publisher import GalleryPayload, publish_gallery, gallery_url
import archive_utils
from image_utils import is_image, is_video


class PublishWorker(QThread):
    """
    端到端发布流程。

    信号：
      log(level, msg): 日志（info/warn/error/success）
      step(step_name): 当前步骤变化
      progress(current, total, msg): 上传进度
      image_uploaded(index, url): 单张图片上传完成
      done(success, result, error): 整个流程结束
    """
    log = pyqtSignal(str, str)
    step = pyqtSignal(str)
    progress = pyqtSignal(int, int, str)
    image_uploaded = pyqtSignal(int, str)
    done = pyqtSignal(bool, str, str)

    def __init__(
        self,
        archive_path: Path,
        payload: GalleryPayload,
        config: AppConfig,
        parent=None,
    ):
        super().__init__(parent)
        self.archive_path = archive_path
        self.payload = payload
        self.config = config
        self._stop = False

    def stop(self):
        self._stop = True

    def run(self):
        try:
            self._run_flow()
        except Exception as e:
            tb = traceback.format_exc()
            self.log.emit('error', f'流程异常: {e}')
            self.log.emit('error', tb)
            self.done.emit(False, '', str(e))

    def _run_flow(self):
        cfg = self.config
        slug = self.payload.slug

        # ───────── ① 解压 ─────────
        self.step.emit('extract')
        self.log.emit('info', f'解压 {self.archive_path.name} ...')
        cfg.temp_path.mkdir(parents=True, exist_ok=True)
        extract_root = cfg.temp_path / slug
        if extract_root.exists():
            import shutil
            shutil.rmtree(extract_root)

        extract_dir = archive_utils.extract_archive(self.archive_path, cfg.temp_path, cfg.archive_passwords)
        all_files = archive_utils.list_files(extract_dir)
        image_files = [p for p in all_files if is_image(p)]
        video_files = [p for p in all_files if is_video(p)]
        self.log.emit('success', f'解压完成：{len(all_files)} 个文件，{len(image_files)} 张图片，{len(video_files)} 个视频')

        if self._stop: return

        # ───────── ② 清理 ─────────
        self.step.emit('clean')
        self.log.emit('info', '清理非图片/无用文件 ...')
        kept, removed = archive_utils.clean_directory(extract_dir, cfg)
        self.log.emit('success', f'保留 {len(kept)} 个文件，删除 {len(removed)} 个文件')
        for r in removed[:10]:
            self.log.emit('info', f'  - 删除 {r.relative_to(extract_dir)}')
        if len(removed) > 10:
            self.log.emit('info', f'  ... 还有 {len(removed) - 10} 个')

        if self._stop: return

        # ───────── ③ 规范化目录结构 ─────────
        self.step.emit('normalize')
        self.log.emit('info', f'规范化目录结构（slug={slug}）...')
        archive_utils.normalize_structure(extract_dir, slug)
        images_after = sorted(p for p in extract_dir.rglob('*') if p.is_file() and is_image(p))
        videos_after = sorted(p for p in extract_dir.rglob('*') if p.is_file() and is_video(p))
        self.log.emit('success', f'规范化后共 {len(images_after)} 张图片，{len(videos_after)} 个视频')

        if self._stop: return

        # ───────── ④ 重新打包 ─────────
        self.step.emit('repackage')
        cfg.output_path.mkdir(parents=True, exist_ok=True)

        # 压缩包名用中文标题（清理 Windows 非法字符）；内部文件名仍用英文 slug
        import re as _re
        safe_title = _re.sub(r'[<>:"/\\|?*]', '_', self.payload.titleZh or slug).strip() or slug
        archive_out_path = cfg.output_path / f'{safe_title}.tar.lz4'

        # repackage 会根据总大小自动选择 .tar.lz4（≤4GB）或 .zip 分卷（>4GB）
        actual_path = archive_utils.repackage(extract_dir, archive_out_path)
        if actual_path != archive_out_path:
            # 切换为 zip 分卷路径
            archive_out_path = actual_path

        size_mb = archive_out_path.stat().st_size / 1024 / 1024
        # 如果是分卷 zip，统计所有分卷大小
        total_size_mb = size_mb
        if archive_out_path.suffix.lower() == '.zip':
            all_parts = list(archive_out_path.parent.glob(f'{archive_out_path.stem}.z*'))
            if all_parts:
                total_size_mb = (
                    sum(p.stat().st_size for p in all_parts) + archive_out_path.stat().st_size
                ) / 1024 / 1024
        self.log.emit('success', f'打包完成：{archive_out_path.name}  ({total_size_mb:.2f} MB)')

        if self._stop: return

        # ───────── ⑤ 上传图片到图床 ─────────
        self.step.emit('upload')
        self.log.emit('info', f'开始上传 {len(images_after)} 张图片到图床 ...')

        urls: list[str] = [''] * len(images_after)
        failures: list[tuple[int, str]] = []
        MAX_RETRIES = 3
        import time
        from concurrent.futures import ThreadPoolExecutor, as_completed

        # 分批并发：批内并行加速，批间串行保证图床接收顺序与文件顺序一致
        batch_size = max(1, min(10, cfg.concurrent_uploads))
        total = len(images_after)
        completed = 0

        def upload_one(idx: int, path: Path) -> tuple[int, str, str]:
            # 不在此处打日志，避免并发线程导致日志乱序
            last_err = ''
            for attempt in range(MAX_RETRIES):
                if self._stop:
                    return idx, '', '已停止'
                try:
                    nsfw = self.payload.rating == 'nsfw'
                    result = upload_image(
                        path, cfg,
                        nsfw=nsfw,
                        title=f'{slug}-{idx + 1:03d}',
                    )
                    return idx, result.url, ''
                except Exception as e:
                    last_err = str(e)
                    if attempt < MAX_RETRIES - 1:
                        time.sleep(2 * (attempt + 1))
            return idx, '', last_err

        for batch_start in range(0, total, batch_size):
            if self._stop:
                break
            batch = list(enumerate(images_after[batch_start:batch_start + batch_size], start=batch_start))
            # 提交前按 idx 顺序打印"开始上传"，保证日志有序
            for idx, path in batch:
                self.log.emit('info', f'  [{idx + 1}/{total}] 上传 {path.name} ...')
            with ThreadPoolExecutor(max_workers=len(batch)) as pool:
                futures = {pool.submit(upload_one, i, p): i for i, p in batch}
                # 按 idx 顺序收集结果，保证日志/进度输出有序
                results_map: dict[int, tuple[str, str]] = {}
                for f in as_completed(futures):
                    idx, url, err = f.result()
                    results_map[idx] = (url, err)
                for idx, _ in batch:
                    url, err = results_map[idx]
                    completed += 1
                    if url:
                        urls[idx] = url
                        self.image_uploaded.emit(idx, url)
                        self.log.emit('success', f'  [{idx + 1}] OK: {url}')
                    else:
                        failures.append((idx, err))
                        self.log.emit('error', f'  [{idx + 1}] 失败（已重试 {MAX_RETRIES} 次）: {err}')
                    self.progress.emit(completed, total, f'{completed}/{total}')

        if self._stop: return

        ok_urls = [u for u in urls if u]
        if not ok_urls:
            raise RuntimeError('没有图片上传成功')

        # 任何一张失败都终止发布（已重试过 MAX_RETRIES 次）
        if failures:
            err_lines = '\n'.join(f'  [{i + 1}] {err}' for i, err in failures[:20])
            raise RuntimeError(
                f'{len(failures)} 张图片上传失败（每张已重试 {MAX_RETRIES} 次），终止发布：\n{err_lines}'
            )

        # ───────── ⑥ 填充字段并发布 ─────────
        self.step.emit('publish')
        self.payload.cover = ok_urls[0]
        self.payload.images = ok_urls

        self.log.emit('info', f'发布到 cosplay 后台：slug={slug}, 标题={self.payload.titleZh}, 图片={len(ok_urls)} 张')

        result = publish_gallery(self.payload, cfg)
        gallery_link = gallery_url(slug, cfg)
        self.log.emit('success', f'发布成功！')
        self.log.emit('success', f'图包地址: {gallery_link}')
        self.log.emit('success', f'下载包: {archive_out_path}')

        self.done.emit(True, gallery_link, '')
