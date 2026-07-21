"""
Bot 消息处理：收到压缩包 → 下载 → 跑 pipeline → 推送进度。

使用 Telethon (MTProto)，突破 Bot API 20MB 下载限制，最大支持 2GB。
"""
from __future__ import annotations
from pathlib import Path
import asyncio
import re
import shutil
import traceback
import threading

from config import AppConfig
from tg_bot import TgBot
from gallery_publisher import (
    GalleryPayload, publish_gallery, gallery_url,
    auto_slug, generate_slug,
)
from uploader import upload_image
import archive_utils
from image_utils import is_image, is_video
from title_parser import parse_archive_title


# Telethon 下载文件大小限制：2GB（MTProto 单文件最大）
TG_FILE_SIZE_LIMIT = 2 * 1024 * 1024 * 1024


class BotHandler:
    """处理 bot 收到的消息。线程安全：每个消息独立跑 pipeline。"""

    def __init__(self, bot: TgBot, config: AppConfig):
        self.bot = bot
        self.config = config
        self._lock = threading.Lock()  # 串行处理多个消息，避免资源竞争

    async def handle_update(self, event):
        """入口：处理一个 Telethon NewMessage 事件。"""
        msg = event.message
        if msg is None:
            return

        chat_id = msg.chat_id
        if chat_id is None:
            return

        # 白名单校验
        allowed = self.config.tg_allowed_chat_ids or []
        if allowed and chat_id not in allowed:
            await self._send(chat_id, '⛔ 未授权的 chat')
            return

        text = (msg.message or '').strip()
        doc = msg.document  # telethon 的 Document 对象（可能为 None）

        # 命令处理
        if not doc:
            if text in ('/start', '/help'):
                await self._send(
                    chat_id,
                    '📦 直接把压缩包（zip/rar/7z，含分卷）转发给我，\n'
                    '我会自动解压、清理、重打包、上传图床并发布到后台。\n\n'
                    '支持最大 2GB 的单文件。\n\n'
                    '命令：\n'
                    '  /start /help — 显示此帮助\n'
                    '  /status — 查看 bot 状态'
                )
            elif text == '/status':
                me = self.bot.get_me()
                await self._send(
                    chat_id,
                    f'✅ Bot 在线: @{me.get("username", "?")}'
                )
            return

        # 文档消息：放到锁里串行处理
        asyncio.ensure_future(self._process_document(chat_id, msg, doc))

    async def _process_document(self, chat_id: int, msg, doc):
        """在 loop 线程里抢 async lock，串行处理文档。"""
        async with self._async_lock():
            try:
                archive_path = await self._download_and_validate(chat_id, msg, doc)
                if archive_path is None:
                    return
                payload = await self._prepare_payload(chat_id, archive_path)
                # pipeline 是 CPU/IO 密集型同步代码，放到线程池跑
                await asyncio.to_thread(self._run_pipeline, chat_id, archive_path, payload)
            except Exception as e:
                tb = traceback.format_exc()
                await self._send(
                    chat_id,
                    f'❌ 处理失败: <code>{_escape(str(e))}</code>\n\n'
                    f'<pre>{_escape(tb[-1500:])}</pre>'
                )

    _ASYNC_LOCK = None  # class-level, lazy init

    def _async_lock(self):
        # 单例 asyncio.Lock，必须在 loop 线程里创建
        if BotHandler._ASYNC_LOCK is None:
            BotHandler._ASYNC_LOCK = asyncio.Lock()
        return BotHandler._ASYNC_LOCK

    async def _send(self, chat_id: int, text: str):
        """async 发送（在 loop 线程里直接 await telethon client）。

        注意：不能用 self.bot.send_message（同步方法，会 run_coroutine_threadsafe
        提交到 loop 自己导致死锁）。这里直接调用 telethon client。
        """
        client = self.bot.client
        if client is None:
            return
        if len(text) > 4000:
            text = text[:4000] + '...'
        try:
            await client.send_message(chat_id, text, parse_mode='HTML', link_preview=False)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning('发送 TG 消息失败: %s', e)

    async def _download_and_validate(self, chat_id: int, msg, doc) -> Path | None:
        """下载文件并校验。返回文件路径或 None（校验失败时）。"""
        file_name = 'archive'
        file_size = 0
        from telethon.tl.types import DocumentAttributeFilename
        for attr in (doc.attributes or []):
            if isinstance(attr, DocumentAttributeFilename):
                file_name = attr.file_name or file_name
        file_size = doc.size or 0

        await self._send(
            chat_id,
            f'📥 收到文件: <b>{_escape(file_name)}</b>\n'
            f'大小: {file_size / 1024 / 1024:.2f} MB'
        )

        if file_size > TG_FILE_SIZE_LIMIT:
            await self._send(chat_id, '⚠️ 文件超过 2GB（MTProto 限制），无法处理')
            return None

        await self._send(chat_id, '⬇️ 下载中 ...')
        download_dir = self.config.temp_path / 'tg_downloads'
        download_dir.mkdir(parents=True, exist_ok=True)
        archive_path = download_dir / file_name
        # telethon 的 download_media 是 async
        client = self.bot.client
        result = await client.download_media(msg, file=str(archive_path))
        if result:
            archive_path = Path(result)
        await self._send(chat_id, f'✅ 下载完成: {archive_path.name}')

        if not archive_utils.is_archive(archive_path):
            await self._send(
                chat_id,
                f'⚠️ 不是支持的压缩包格式: {archive_path.suffix}'
            )
            archive_path.unlink(missing_ok=True)
            return None

        return archive_path

    async def _prepare_payload(self, chat_id: int, archive_path: Path) -> GalleryPayload:
        """解析标题、生成 slug、构造 payload。"""
        parsed = parse_archive_title(archive_path.stem)
        title_zh = parsed.clean_title or archive_path.stem
        cosplayer = parsed.cosplayer or ''
        character = parsed.character or ''

        await self._send(
            chat_id,
            f'📋 解析:\n'
            f'  标题: <b>{_escape(title_zh)}</b>\n'
            f'  Coser: {_escape(cosplayer or "(空)")}\n'
            f'  Character: {_escape(character or "(空)")}\n'
            f'  生成 Slug 中 ...'
        )

        # auto_slug 内部会发 HTTP 翻译请求，放到线程里避免阻塞 loop
        slug, en_title = await asyncio.to_thread(auto_slug, title_zh, '', '')
        if not slug:
            slug = generate_slug(title_zh) or 'gallery'
            en_title = ''

        payload = GalleryPayload(
            slug=slug,
            titleZh=title_zh,
            titleEn=en_title,
            cosplayer=cosplayer,
            character=character,
            rating=self.config.tg_default_rating,
            price=self.config.tg_default_price,
            isPremium=self.config.tg_default_premium,
        )

        await self._send(
            chat_id,
            f'🔑 Slug: <code>{_escape(slug)}</code>\n🚀 开始 pipeline ...'
        )
        return payload

    def _run_pipeline(self, chat_id: int, archive_path: Path, payload: GalleryPayload):
        """同步 pipeline（在线程池里跑）。通过 self.bot.send_message 推送进度。"""
        cfg = self.config
        slug = payload.slug

        def notify(level: str, msg: str):
            emoji = {
                'info': 'ℹ️', 'success': '✅', 'warn': '⚠️', 'error': '❌'
            }.get(level, '•')
            try:
                self.bot.send_message(chat_id, f'{emoji} {_escape(msg)}')
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning('notify 失败: %s', e)

        # ───────── ① 解压 ─────────
        notify('info', f'① 解压 {archive_path.name} ...')
        cfg.temp_path.mkdir(parents=True, exist_ok=True)
        extract_root = cfg.temp_path / slug
        if extract_root.exists():
            shutil.rmtree(extract_root)
        extract_dir = archive_utils.extract_archive(archive_path, cfg.temp_path, cfg.archive_passwords)
        all_files = archive_utils.list_files(extract_dir)
        image_files = [p for p in all_files if is_image(p)]
        video_files = [p for p in all_files if is_video(p)]
        notify('success', f'解压完成: {len(all_files)} 文件 / {len(image_files)} 图 / {len(video_files)} 视频')

        # ───────── ② 清理 ─────────
        notify('info', '② 清理非媒体文件 ...')
        kept, removed = archive_utils.clean_directory(extract_dir, cfg)
        notify('success', f'保留 {len(kept)}，删除 {len(removed)}')

        # ───────── ③ 规范化 ─────────
        notify('info', f'③ 规范化结构（slug={slug}）...')
        archive_utils.normalize_structure(extract_dir, slug)
        images_after = sorted(p for p in extract_dir.rglob('*') if p.is_file() and is_image(p))
        videos_after = sorted(p for p in extract_dir.rglob('*') if p.is_file() and is_video(p))
        notify('success', f'规范化后: {len(images_after)} 图 / {len(videos_after)} 视频')

        # ───────── ④ 重新打包 ─────────
        notify('info', '④ 重新打包 ...')
        cfg.output_path.mkdir(parents=True, exist_ok=True)
        safe_title = re.sub(r'[<>:"/\\|?*]', '_', payload.titleZh or slug).strip() or slug
        archive_out_path = cfg.output_path / f'{safe_title}.tar.lz4'
        actual_path = archive_utils.repackage(extract_dir, archive_out_path)
        if actual_path != archive_out_path:
            archive_out_path = actual_path
        size_mb = archive_out_path.stat().st_size / 1024 / 1024
        notify('success', f'打包完成: {archive_out_path.name} ({size_mb:.2f} MB)')

        # ───────── ⑤ 上传图片 ─────────
        notify('info', f'⑤ 上传 {len(images_after)} 张图片到图床 ...')
        urls: list[str] = [''] * len(images_after)
        failures: list[tuple[int, str]] = []
        MAX_RETRIES = 3
        import time as _time
        from concurrent.futures import ThreadPoolExecutor, as_completed

        # 分批并发：批内并行加速，批间串行保证图床接收顺序与文件顺序一致
        batch_size = max(1, min(10, cfg.concurrent_uploads))
        total = len(images_after)
        completed = 0

        def upload_one(idx: int, path: Path) -> tuple[int, str, str]:
            last_err = ''
            for attempt in range(MAX_RETRIES):
                try:
                    nsfw = payload.rating == 'nsfw'
                    result = upload_image(path, cfg, nsfw=nsfw, title=f'{slug}-{idx + 1:03d}')
                    return idx, result.url, ''
                except Exception as e:
                    last_err = str(e)
                    if attempt < MAX_RETRIES - 1:
                        _time.sleep(2 * (attempt + 1))
            return idx, '', last_err

        for batch_start in range(0, total, batch_size):
            batch = list(enumerate(images_after[batch_start:batch_start + batch_size], start=batch_start))
            with ThreadPoolExecutor(max_workers=len(batch)) as pool:
                futures = {pool.submit(upload_one, i, p): i for i, p in batch}
                results_map: dict[int, tuple[str, str]] = {}
                for f in as_completed(futures):
                    idx, url, err = f.result()
                    results_map[idx] = (url, err)
                for idx, _ in batch:
                    url, err = results_map[idx]
                    completed += 1
                    if url:
                        urls[idx] = url
                    else:
                        failures.append((idx, err))
                    # 每 10 张或最后一张报告进度
                    if completed % 10 == 0 or completed == total:
                        try:
                            self.bot.send_message(
                                chat_id,
                                f'📤 进度: {completed}/{total}'
                                + (f'，失败 {len(failures)}' if failures else '')
                            )
                        except Exception:
                            pass

        ok_urls = [u for u in urls if u]
        if not ok_urls:
            raise RuntimeError('没有图片上传成功')
        # 任何一张失败都终止发布（已重试过 MAX_RETRIES 次）
        if failures:
            err_lines = '\n'.join(f'  [{i + 1}] {err}' for i, err in failures[:20])
            raise RuntimeError(
                f'{len(failures)} 张图片上传失败（每张已重试 {MAX_RETRIES} 次），终止发布：\n{err_lines}'
            )

        # ───────── ⑥ 发布 ─────────
        notify('info', '⑥ 发布到后台 ...')
        payload.cover = ok_urls[0]
        payload.images = ok_urls
        publish_gallery(payload, cfg)
        gallery_link = gallery_url(slug, cfg)
        notify('success', '🎉 发布成功！')
        try:
            self.bot.send_message(
                chat_id,
                f'🔗 <a href="{_escape(gallery_link)}">{_escape(gallery_link)}</a>\n'
                f'📦 下载包: <code>{_escape(str(archive_out_path))}</code>\n'
                f'🖼️ 图片: {len(ok_urls)} 张\n'
                f'🏷️ Slug: <code>{_escape(slug)}</code>'
            )
        except Exception:
            pass


def _escape(s: str) -> str:
    """HTML 转义（TG 用 HTML parse_mode）。"""
    return (str(s)
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;'))
