"""端到端发布流程：解压 → 清理 → 规范化 → 重打包 → 压缩上传 → 发布。"""
from __future__ import annotations
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import traceback

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
            self.log('error', f'流程异常: {e}')
            self.log('error', tb)
            self.done.emit(False, '', str(e))

    def _run_flow(self):
        cfg = self.config
        slug = self.payload.slug

        # ───────── ① 解压 ─────────
        self.step.emit('extract')
        self.log('info', f'解压 {self.archive_path.name} ...')
        cfg.temp_path.mkdir(parents=True, exist_ok=True)
        extract_root = cfg.temp_path / slug
        if extract_root.exists():
            import shutil
            shutil.rmtree(extract_root)

        extract_dir = archive_utils.extract_archive(self.archive_path, cfg.temp_path)
        all_files = archive_utils.list_files(extract_dir)
        image_files = [p for p in all_files if is_image(p)]
        video_files = [p for p in all_files if is_video(p)]
        self.log('success', f'解压完成：{len(all_files)} 个文件，{len(image_files)} 张图片，{len(video_files)} 个视频')

        if self._stop: return

        # ───────── ② 清理 ─────────
        self.step.emit('clean')
        self.log('info', '清理非图片/无用文件 ...')
        kept, removed = archive_utils.clean_directory(extract_dir, cfg)
        self.log('success', f'保留 {len(kept)} 个文件，删除 {len(removed)} 个文件')
        for r in removed[:10]:
            self.log('info', f'  - 删除 {r.relative_to(extract_dir)}')
        if len(removed) > 10:
            self.log('info', f'  ... 还有 {len(removed) - 10} 个')

        if self._stop: return

        # ───────── ③ 规范化目录结构 ─────────
        self.step.emit('normalize')
        self.log('info', f'规范化目录结构（slug={slug}）...')
        archive_utils.normalize_structure(extract_dir, slug)
        images_after = sorted(p for p in extract_dir.rglob('*') if p.is_file() and is_image(p))
        videos_after = sorted(p for p in extract_dir.rglob('*') if p.is_file() and is_video(p))
        self.log('success', f'规范化后共 {len(images_after)} 张图片，{len(videos_after)} 个视频')

        if self._stop: return

        # ───────── ④ 重新打包 ─────────
        self.step.emit('repackage')
        cfg.output_path.mkdir(parents=True, exist_ok=True)
        zip_path = cfg.output_path / f'{slug}.zip'
        self.log('info', f'重新打包 → {zip_path.name} ...')
        archive_utils.repackage(extract_dir, zip_path)
        size_mb = zip_path.stat().st_size / 1024 / 1024
        self.log('success', f'打包完成：{zip_path}  ({size_mb:.2f} MB)')

        if self._stop: return

        # ───────── ⑤ 上传图片到图床 ─────────
        self.step.emit('upload')
        self.log('info', f'开始上传 {len(images_after)} 张图片到图床 ...')

        urls: list[str] = [''] * len(images_after)
        failures: list[tuple[int, str]] = []

        def upload_one(idx: int, path: Path) -> tuple[int, str, str]:
            try:
                self.log('info', f'  [{idx + 1}/{len(images_after)}] 上传 {path.name} ...')
                nsfw = self.payload.rating == 'nsfw'
                result = upload_image(
                    path, cfg,
                    nsfw=nsfw,
                    title=f'{slug}-{idx + 1:03d}',
                )
                return idx, result.url, ''
            except Exception as e:
                return idx, '', str(e)

        max_workers = max(1, min(10, cfg.concurrent_uploads))
        completed = 0
        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            futures = [pool.submit(upload_one, i, p) for i, p in enumerate(images_after)]
            for f in futures:
                if self._stop:
                    break
                idx, url, err = f.result()
                completed += 1
                if url:
                    urls[idx] = url
                    self.image_uploaded.emit(idx, url)
                    self.log('success', f'  [{idx + 1}] OK: {url}')
                else:
                    failures.append((idx, err))
                    self.log('error', f'  [{idx + 1}] 失败: {err}')
                self.progress.emit(completed, len(images_after), f'{completed}/{len(images_after)}')

        if self._stop: return

        ok_urls = [u for u in urls if u]
        if not ok_urls:
            raise RuntimeError('没有图片上传成功')

        if len(ok_urls) < len(images_after):
            self.log('warn', f'{len(images_after) - len(ok_urls)} 张图片上传失败，继续发布成功的图片')

        # ───────── ⑥ 填充字段并发布 ─────────
        self.step.emit('publish')
        self.payload.cover = ok_urls[0]
        self.payload.images = ok_urls

        self.log('info', f'发布到 cosplay 后台：slug={slug}, 标题={self.payload.titleZh}, 图片={len(ok_urls)} 张')

        result = publish_gallery(self.payload, cfg)
        gallery_link = gallery_url(slug, cfg)
        self.log('success', f'发布成功！')
        self.log('success', f'图包地址: {gallery_link}')
        self.log('success', f'下载包: {zip_path}')

        self.done.emit(True, gallery_link, '')
