"""Chevereto 图床上传。"""
from __future__ import annotations
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable
import requests

from config import AppConfig
from image_utils import compress_image


DEFAULT_UPLOAD_PATH = '/api/1/upload'


@dataclass
class UploadResult:
    url: str
    delete_url: str = ''
    thumb_url: str = ''
    original_size: int = 0
    uploaded_size: int = 0


def resolve_upload_url(api_url: str) -> str:
    raw = api_url.strip()
    if not raw:
        return ''
    import re
    if re.match(r'^https?://[^/]+/?$', raw, re.IGNORECASE):
        return raw.rstrip('/') + DEFAULT_UPLOAD_PATH
    return raw


def upload_image(
    src_path: Path,
    config: AppConfig,
    nsfw: bool | None = None,
    title: str = '',
    on_progress: Callable[[int], None] | None = None,
) -> UploadResult:
    """上传单张图片到 Chevereto。"""
    api_url = resolve_upload_url(config.api_url)
    if not api_url or not config.api_key:
        raise RuntimeError('请先在设置中配置 Chevereto API URL 和 API Key')

    if config.compress_enabled:
        file_bytes, content_type, orig_size = compress_image(
            src_path,
            quality=config.compress_quality,
            max_width=config.compress_max_width,
            fmt=config.compress_format,
        )
    else:
        file_bytes = src_path.read_bytes()
        content_type = _guess_mime(src_path.suffix)
        orig_size = len(file_bytes)

    uploaded_size = len(file_bytes)
    ext = _ext_for_format(config.compress_format) if config.compress_enabled else src_path.suffix
    filename = (src_path.stem if not title else title) + ext

    nsfw_val = config.default_nsfw if nsfw is None else nsfw

    form = {
        'source': (filename, file_bytes, content_type),
        'nsfw': (None, '1' if nsfw_val else '0'),
        'format': (None, 'json'),
    }
    if title:
        form['title'] = (None, title)

    headers = {'X-API-Key': config.api_key.strip()}

    resp = requests.post(api_url, files=form, headers=headers, timeout=120)

    if on_progress:
        on_progress(100)

    if resp.status_code >= 400:
        text = resp.text[:300] if resp.text else ''
        raise RuntimeError(f'HTTP {resp.status_code}: {text}')

    try:
        data = resp.json()
    except Exception:
        raise RuntimeError('响应不是合法 JSON')

    url = _extract_url(data)
    if not url:
        reason = data.get('status_txt') or data.get('message') or '未知错误'
        raise RuntimeError(f'上传失败: {reason}')

    img = data.get('image') if isinstance(data.get('image'), dict) else {}
    return UploadResult(
        url=url,
        delete_url=img.get('delete_url', '') or '',
        thumb_url=(img.get('thumb') or {}).get('url', '') if isinstance(img.get('thumb'), dict) else '',
        original_size=orig_size,
        uploaded_size=uploaded_size,
    )


def _extract_url(data: dict) -> str:
    img = data.get('image')
    if isinstance(img, dict) and img.get('url'):
        return img['url']
    if isinstance(img, str) and img:
        return img
    if data.get('url'):
        return data['url']
    return ''


def _guess_mime(ext: str) -> str:
    ext = ext.lower()
    return {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
    }.get(ext, 'application/octet-stream')


def _ext_for_format(fmt: str) -> str:
    return {'JPEG': '.jpg', 'PNG': '.png', 'WEBP': '.webp'}.get(fmt, '.jpg')
