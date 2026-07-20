"""
压缩包处理工具：解压 → 清理 → 重新打包。

支持 zip / rar / 7z。
"""
from __future__ import annotations
from pathlib import Path
import zipfile
import shutil

from config import AppConfig
from image_utils import is_image, is_video, is_media


SUPPORTED_ARCHIVES = {'.zip', '.rar', '.7z'}


def is_archive(path: Path) -> bool:
    return path.suffix.lower() in SUPPORTED_ARCHIVES


def extract_archive(archive_path: Path, dest_dir: Path) -> Path:
    """
    解压到 dest_dir 下的一个子目录（用压缩包名命名），返回该子目录。
    会自动剥离压缩包内顶层的单一根目录（让内部文件直接位于子目录下）。
    """
    dest_dir.mkdir(parents=True, exist_ok=True)
    extract_root = dest_dir / archive_path.stem
    if extract_root.exists():
        shutil.rmtree(extract_root)
    extract_root.mkdir(parents=True)

    suffix = archive_path.suffix.lower()
    if suffix == '.zip':
        with zipfile.ZipFile(archive_path, 'r') as zf:
            zf.extractall(extract_root)
    elif suffix == '.rar':
        import rarfile
        with rarfile.RarFile(archive_path, 'r') as rf:
            rf.extractall(extract_root)
    elif suffix == '.7z':
        import py7zr
        with py7zr.SevenZipFile(archive_path, 'r') as sz:
            sz.extractall(extract_root)
    else:
        raise RuntimeError(f'不支持的压缩格式: {archive_path.suffix}')

    # 如果顶层只有一个目录，下钻一层
    children = [p for p in extract_root.iterdir() if not p.name.startswith('.')]
    if len(children) == 1 and children[0].is_dir():
        inner = children[0]
        for item in inner.iterdir():
            shutil.move(str(item), str(extract_root / item.name))
        inner.rmdir()

    return extract_root


def list_files(root: Path) -> list[Path]:
    """列出目录下所有文件（递归，相对路径），按文件名排序。"""
    files = sorted(p for p in root.rglob('*') if p.is_file())
    return files


def should_remove(path: Path, config: AppConfig) -> bool:
    """根据清理规则判断该文件是否应被删除。"""
    name = path.name
    if name in config.clean_exclude_names:
        return True
    if name.lower().startswith('ewm_'):
        return True
    ext = path.suffix.lower()
    if ext in config.clean_exclude_exts:
        return True
    # 清理所有非媒体（非图片且非视频）文件
    if config.auto_clean_non_image and not is_media(path):
        return True
    return False


def clean_directory(root: Path, config: AppConfig) -> tuple[list[Path], list[Path]]:
    """
    按清理规则扫描目录，返回 (kept_files, removed_files)。
    实际删除文件。
    """
    kept = []
    removed = []

    for p in list_files(root):
        if should_remove(p, config):
            p.unlink()
            removed.append(p)
        else:
            kept.append(p)

    # 清理空目录
    for p in sorted(root.rglob('*'), reverse=True):
        if p.is_dir() and not any(p.iterdir()):
            p.rmdir()

    return kept, removed


def normalize_structure(root: Path, slug: str) -> None:
    """
    规范化目录结构：把所有图片和视频平铺到 root/ 下，去掉子目录。
    - 图片统一重命名为 slug-001.jpg / slug-002.jpg ...
    - 视频保留原扩展名，命名为 slug-vid-001.mp4 / slug-vid-002.mov ...
    """
    images = sorted(p for p in root.rglob('*') if p.is_file() and is_image(p))
    videos = sorted(p for p in root.rglob('*') if p.is_file() and is_video(p))

    if not images and not videos:
        return

    rename_map: list[tuple[Path, Path]] = []
    used_names: set[str] = set()

    def _unique(new_name: str) -> str:
        n = 1
        candidate = new_name
        while candidate in used_names:
            stem, dot, ext = new_name.rpartition('.')
            candidate = f'{stem}-{n}.{ext}' if dot else f'{new_name}-{n}'
            n += 1
        used_names.add(candidate)
        return candidate

    # 图片统一改 .jpg
    for i, src in enumerate(images, start=1):
        new_name = _unique(f'{slug}-{i:03d}.jpg')
        rename_map.append((src, root / new_name))

    # 视频保留原扩展名
    for i, src in enumerate(videos, start=1):
        ext = src.suffix.lower()
        new_name = _unique(f'{slug}-vid-{i:03d}{ext}')
        rename_map.append((src, root / new_name))

    # 第一步：先把所有原文件改名到临时名（避免冲突）
    temp_map: list[tuple[Path, Path]] = []
    for src, dst in rename_map:
        tmp = src.with_suffix(f'.tmp{src.suffix}')
        src.rename(tmp)
        temp_map.append((tmp, dst))

    # 第二步：从临时名改为目标名，并移动到 root 顶层
    for tmp, dst in temp_map:
        if tmp != dst:
            if dst.exists():
                dst.unlink()
            tmp.rename(dst)

    # 删除剩余的子目录
    for p in sorted(root.rglob('*'), reverse=True):
        if p.is_dir():
            try:
                p.rmdir()
            except OSError:
                pass


def should_exclude_in_zip(path: Path) -> bool:
    """打包时再次过滤：排除 .txt 后缀和 ewm_ 开头的文件（双保险）。"""
    name = path.name
    if name.lower().startswith('ewm_'):
        return True
    if path.suffix.lower() == '.txt':
        return True
    return False


def repackage(root: Path, output_path: Path) -> Path:
    """把目录重新打包为 zip，返回 zip 路径。"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        output_path.unlink()
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for p in sorted(root.rglob('*')):
            if p.is_file() and not should_exclude_in_zip(p):
                zf.write(p, p.relative_to(root))
    return output_path
