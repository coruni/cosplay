from pathlib import Path
from io import BytesIO
from PIL import Image


SUPPORTED_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff'}

VIDEO_EXTS = {'.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v', '.wmv', '.flv', '.ts'}


def is_image(path: str | Path) -> bool:
    return Path(path).suffix.lower() in SUPPORTED_EXTS


def is_video(path: str | Path) -> bool:
    return Path(path).suffix.lower() in VIDEO_EXTS


def is_media(path: str | Path) -> bool:
    """图片或视频。"""
    return is_image(path) or is_video(path)


def compress_image(
    src_path: str | Path,
    quality: int = 85,
    max_width: int = 1920,
    fmt: str = 'JPEG',
) -> tuple[bytes, str, int]:
    """
    Compress an image and return (bytes, content_type, original_size).
    If compression would make it larger, returns the original bytes.
    """
    src = Path(src_path)
    original_size = src.stat().st_size

    img = Image.open(src)

    if img.mode not in ('RGB', 'L'):
        if fmt == 'JPEG':
            img = img.convert('RGB')
        elif img.mode == 'RGBA' and fmt == 'PNG':
            pass
        elif img.mode == 'P':
            img = img.convert('RGBA' if fmt == 'PNG' else 'RGB')

    if max_width and img.width > max_width:
        ratio = max_width / img.width
        new_h = int(img.height * ratio)
        img = img.resize((max_width, new_h), Image.Resampling.LANCZOS)

    buf = BytesIO()
    save_kwargs = {}
    content_type = 'image/jpeg'

    if fmt == 'JPEG':
        save_kwargs = {'quality': quality, 'optimize': True, 'progressive': True}
        content_type = 'image/jpeg'
    elif fmt == 'PNG':
        save_kwargs = {'optimize': True}
        content_type = 'image/png'
    elif fmt == 'WEBP':
        save_kwargs = {'quality': quality, 'method': 6}
        content_type = 'image/webp'

    img.save(buf, format=fmt, **save_kwargs)
    compressed = buf.getvalue()

    if len(compressed) >= original_size:
        return src.read_bytes(), _guess_content_type(src.suffix), original_size

    return compressed, content_type, original_size


def _guess_content_type(ext: str) -> str:
    ext = ext.lower()
    if ext in ('.jpg', '.jpeg'):
        return 'image/jpeg'
    if ext == '.png':
        return 'image/png'
    if ext == '.webp':
        return 'image/webp'
    if ext == '.gif':
        return 'image/gif'
    if ext in ('.bmp',):
        return 'image/bmp'
    return 'application/octet-stream'
