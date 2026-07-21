"""
压缩包处理工具：解压 → 清理 → 重新打包。

输入支持 zip / rar / 7z，含分卷格式（.part1.rar / .z01+.zip / .7z.001 / .001）。
输出为 .tar.lz4（LZ4 Frame 格式，≤4GB）或 .zip 分卷（>4GB）。
"""
from __future__ import annotations
from pathlib import Path
import os
import re
import tarfile
import io
import zipfile
import shutil

from config import AppConfig
from image_utils import is_image, is_video, is_media


SUPPORTED_ARCHIVES = {'.zip', '.rar', '.7z'}

# 分卷命名模式（按优先级匹配）
_RAR_PART_RE = re.compile(r'^(?P<stem>.+)\.part(?P<idx>\d+)\.rar$', re.IGNORECASE)
_7Z_PART_RE = re.compile(r'^(?P<stem>.+)\.7z\.(?P<idx>\d{3,})$', re.IGNORECASE)
_GENERIC_PART_RE = re.compile(r'^(?P<stem>.+)\.(?P<idx>\d{3,})$', re.IGNORECASE)
_ZIP_PART_RE = re.compile(r'^z(?P<idx>\d{2,})$', re.IGNORECASE)


def is_archive(path: Path) -> bool:
    """识别单卷压缩包或任意一个分卷文件。"""
    name = path.name.lower()
    if path.suffix.lower() in SUPPORTED_ARCHIVES:
        return True
    # .partN.rar
    if _RAR_PART_RE.match(name):
        return True
    # .7z.NNN
    if _7Z_PART_RE.match(name):
        return True
    # .NNN（通用分卷）
    if _GENERIC_PART_RE.match(name):
        return True
    # zNN 形式（zip 分卷的 .z01/.z02 ...）
    if _ZIP_PART_RE.match(path.stem) and path.suffix.lower() == '':
        return True
    return False


def _resolve_main_volume(path: Path) -> Path:
    """把任意一个分卷文件映射到主卷（用于解压）。

    - .partN.rar   → .part1.rar
    - .7z.NNN      → .7z.001
    - xxx.7z.NNN   → xxx.7z.001
    - zNN (zip 分卷)→ .zip（同目录下的主 .zip）
    - .NNN         → xxx.7z.001 / xxx.zip.001（保持原样）
    """
    name = path.name
    low = name.lower()

    m = _RAR_PART_RE.match(name)
    if m:
        return path.with_name(f"{m.group('stem')}.part1.rar")

    m = _7Z_PART_RE.match(name)
    if m:
        return path.with_name(f"{m.group('stem')}.7z.001")

    # zNN 文件（无后缀，stem 形如 z01）
    if _ZIP_PART_RE.match(path.stem) and path.suffix.lower() == '':
        # 主卷是同目录下的 .zip
        parent = path.parent
        zips = list(parent.glob('*.zip')) + list(parent.glob('*.ZIP'))
        if zips:
            return zips[0]
        return path

    # 通用分卷 .NNN
    m = _GENERIC_PART_RE.match(name)
    if m:
        # 已经是 .001 或类似主卷
        return path

    return path


def _archive_stem_for_extract(path: Path) -> str:
    """解压子目录名用主卷的 stem（去掉分卷后缀）。"""
    name = path.name
    m = _RAR_PART_RE.match(name)
    if m:
        return m.group('stem')
    m = _7Z_PART_RE.match(name)
    if m:
        return m.group('stem')
    if _ZIP_PART_RE.match(path.stem) and path.suffix.lower() == '':
        # zip 分卷，主卷是 xxx.zip
        parent = path.parent
        zips = list(parent.glob('*.zip')) + list(parent.glob('*.ZIP'))
        if zips:
            return zips[0].stem
        return path.stem
    # 通用分卷
    m = _GENERIC_PART_RE.match(name)
    if m:
        return m.group('stem')
    return path.stem


def _combine_zip_split(main_zip: Path, dest: Path) -> Path:
    """把 .z01 + .z02 + ... + .zip 合并为单个 zip 文件（用于 zipfile 解压）。

    ZIP 分卷规范：.z01, .z02, ..., .zNN, .zip（主卷是最后一卷，包含中央目录）。
    7-Zip 生成的顺序切分可能 .zip 在前，这里两种都尝试。
    """
    parent = main_zip.parent
    stem = main_zip.stem

    # 收集所有 zNN 分卷
    parts = []
    for p in parent.iterdir():
        if not p.is_file():
            continue
        m = _ZIP_PART_RE.match(p.stem)
        if m and p.suffix.lower() == '':
            try:
                idx = int(m.group('idx'))
                parts.append((idx, p))
            except ValueError:
                pass
    parts.sort(key=lambda x: x[0])

    # 没有分卷，直接返回原文件
    if not parts:
        return main_zip

    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open('wb') as out:
        # 标准分卷：z01, z02, ..., zNN 在前，.zip 在后
        # 顺序切分：.zip 在前，.z01, .z02 在后
        # 试标准规范：先 zNN 后 .zip
        # 检测：如果 .zip 文件大小 < 任意 zNN，可能是 .zip 在最后
        zip_size = main_zip.stat().st_size
        max_part_size = max(p.stat().st_size for _, p in parts) if parts else 0

        if zip_size <= max_part_size:
            # 标准规范：z01...zNN 在前，.zip 是最后一卷
            for _, p in parts:
                with p.open('rb') as f:
                    shutil.copyfileobj(f, out, length=1024 * 1024)
            with main_zip.open('rb') as f:
                shutil.copyfileobj(f, out, length=1024 * 1024)
        else:
            # 顺序切分：.zip 是第一卷
            with main_zip.open('rb') as f:
                shutil.copyfileobj(f, out, length=1024 * 1024)
            for _, p in parts:
                with p.open('rb') as f:
                    shutil.copyfileobj(f, out, length=1024 * 1024)
    return dest


def _merge_numbered_parts(main_part: Path, dest: Path, pattern: re.Pattern) -> Path:
    """把 .NNN 形式分卷按编号顺序合并为单个文件。

    pattern 用于从文件名提取 stem 和 idx，所有 stem 相同的分卷按 idx 升序合并。
    """
    parent = main_part.parent
    m = pattern.match(main_part.name)
    if not m:
        # 单卷，直接复制
        shutil.copyfile(main_part, dest)
        return dest
    stem = m.group('stem')

    parts = []
    for p in parent.iterdir():
        if not p.is_file():
            continue
        mm = pattern.match(p.name)
        if mm and mm.group('stem') == stem:
            try:
                parts.append((int(mm.group('idx')), p))
            except ValueError:
                pass
    if not parts:
        shutil.copyfile(main_part, dest)
        return dest

    parts.sort(key=lambda x: x[0])
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open('wb') as out:
        for _, p in parts:
            with p.open('rb') as f:
                shutil.copyfileobj(f, out, length=1024 * 1024)
    return dest


def _is_zip_encrypted(zip_path: Path) -> bool:
    """检测 zip 是否加密。"""
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            for info in zf.infolist():
                if info.flag_bits & 0x1:  # 加密标志位
                    return True
    except Exception:
        pass
    return False


def _try_extract_zip(zip_path: Path, extract_root: Path, passwords: list[str]) -> None:
    """尝试用密码列表解压 zip。"""
    # 先试无密码
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(extract_root)
        return
    except RuntimeError as e:
        if 'encrypted' not in str(e).lower() and 'password' not in str(e).lower():
            raise
    except Exception as e:
        # zipfile 遇到加密文件也可能抛 BadZipFile 等其他错误
        # 只有明确是加密相关的才继续尝试密码
        if 'encrypted' not in str(e).lower() and 'password' not in str(e).lower():
            raise

    # 遍历密码
    last_err = None
    for pwd in passwords:
        if not pwd:
            continue
        # 清理之前失败的残留
        for p in extract_root.rglob('*'):
            if p.is_file():
                p.unlink()
        try:
            with zipfile.ZipFile(zip_path, 'r') as zf:
                zf.extractall(extract_root, pwd=pwd.encode('utf-8'))
            return
        except Exception as e:
            last_err = e
            continue
    raise RuntimeError(f'zip 解压失败（可能密码错误）: {last_err}')


def _try_extract_rar(rar_path: Path, extract_root: Path, passwords: list[str]) -> None:
    """尝试用密码列表解压 rar。"""
    import rarfile
    # 先试无密码
    try:
        with rarfile.RarFile(rar_path, 'r') as rf:
            rf.extractall(extract_root)
        return
    except rarfile.RarWrongPassword:
        pass
    except Exception as e:
        if 'password' not in str(e).lower() and 'encrypted' not in str(e).lower():
            raise

    for pwd in passwords:
        if not pwd:
            continue
        for p in extract_root.rglob('*'):
            if p.is_file():
                p.unlink()
        try:
            with rarfile.RarFile(rar_path, 'r') as rf:
                rf.setpassword(pwd)
                rf.extractall(extract_root)
            return
        except Exception:
            continue
    raise RuntimeError('rar 解压失败（可能密码错误）')


def _try_extract_7z(sevenz_path: Path, extract_root: Path, passwords: list[str]) -> None:
    """尝试用密码列表解压 7z。"""
    import py7zr
    # 先试无密码
    try:
        with py7zr.SevenZipFile(sevenz_path, 'r') as sz:
            sz.extractall(extract_root)
        return
    except py7zr.PasswordRequired:
        pass
    except Exception as e:
        if 'password' not in str(e).lower() and 'encrypted' not in str(e).lower():
            raise

    for pwd in passwords:
        if not pwd:
            continue
        for p in extract_root.rglob('*'):
            if p.is_file():
                p.unlink()
        try:
            with py7zr.SevenZipFile(sevenz_path, 'r', password=pwd) as sz:
                sz.extractall(extract_root)
            return
        except Exception:
            continue
    raise RuntimeError('7z 解压失败（可能密码错误）')


def extract_archive(archive_path: Path, dest_dir: Path, passwords: list[str] | None = None) -> Path:
    """
    解压到 dest_dir 下的一个子目录（用压缩包名命名），返回该子目录。
    会自动剥离压缩包内顶层的单一根目录（让内部文件直接位于子目录下）。
    支持单卷和分卷格式。
    passwords: 解压密码列表，遇到加密压缩包时按顺序尝试。
    """
    passwords = passwords or []
    main_volume = _resolve_main_volume(archive_path)
    stem = _archive_stem_for_extract(archive_path)

    dest_dir.mkdir(parents=True, exist_ok=True)
    extract_root = dest_dir / stem
    if extract_root.exists():
        shutil.rmtree(extract_root)
    extract_root.mkdir(parents=True)

    name = main_volume.name.lower()

    # ZIP 分卷：合并后用 zipfile 解压
    if main_volume.suffix.lower() == '.zip':
        # 检查同目录是否有 .zNN 分卷
        has_split = any(
            _ZIP_PART_RE.match(p.stem) and p.suffix.lower() == ''
            for p in main_volume.parent.iterdir() if p.is_file()
        )
        if has_split:
            combined = dest_dir / f'_combined_{stem}.zip'
            try:
                combined = _combine_zip_split(main_volume, combined)
                _try_extract_zip(combined, extract_root, passwords)
            finally:
                if combined.exists():
                    combined.unlink()
        else:
            _try_extract_zip(main_volume, extract_root, passwords)
    elif _RAR_PART_RE.match(name) or main_volume.suffix.lower() == '.rar':
        _try_extract_rar(main_volume, extract_root, passwords)
    elif _7Z_PART_RE.match(name) or main_volume.suffix.lower() == '.7z':
        if _7Z_PART_RE.match(name):
            # 分卷 7z：合并所有分卷到一个临时文件再解压
            combined = dest_dir / f'_combined_{stem}.7z'
            try:
                _merge_numbered_parts(main_volume, combined, _7Z_PART_RE)
                _try_extract_7z(combined, extract_root, passwords)
            finally:
                if combined.exists():
                    combined.unlink()
        else:
            _try_extract_7z(main_volume, extract_root, passwords)
    elif _GENERIC_PART_RE.match(name):
        # 通用分卷：合并后尝试 7z / zip 解压
        combined = dest_dir / f'_combined_{stem}.bin'
        try:
            _merge_numbered_parts(main_volume, combined, _GENERIC_PART_RE)
            # 先试 7z
            try:
                _try_extract_7z(combined, extract_root, passwords)
            except Exception:
                # 再试 zip
                _try_extract_zip(combined, extract_root, passwords)
        finally:
            if combined.exists():
                combined.unlink()
    else:
        raise RuntimeError(f'不支持的压缩格式: {archive_path.name}')

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


SPLIT_THRESHOLD_BYTES = 4 * 1024 * 1024 * 1024  # 4GB
SPLIT_VOLUME_BYTES = 4 * 1024 * 1024 * 1024      # 分卷大小 4GB


def _estimate_total_size(root: Path) -> int:
    """估算打包前总字节数（仅过滤后的文件）。"""
    total = 0
    for p in root.rglob('*'):
        if p.is_file() and not should_exclude_in_zip(p):
            try:
                total += p.stat().st_size
            except OSError:
                pass
    return total


def _package_as_zip_split(root: Path, output_path: Path) -> Path:
    """用 zip + 分卷打包，单卷 4GB。返回第一卷路径（.zip / .z01 ...）。"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        output_path.unlink()
    with zipfile.ZipFile(
        output_path,
        'w',
        zipfile.ZIP_DEFLATED,
        compresslevel=6,
        allowZip64=True,
    ) as zf:
        for p in sorted(root.rglob('*')):
            if p.is_file() and not should_exclude_in_zip(p):
                arcname = str(p.relative_to(root)).replace('\\', '/')
                zf.write(p, arcname=arcname)
        # 设置分卷（必须在 with 块内、文件已写入后调用）
        # zipfile 会生成 .zip / .z01 / .z02 ... 形式
    # 分卷需要手动切分：zipfile 不直接支持，这里用文件切片
    _split_file(output_path, SPLIT_VOLUME_BYTES)
    return output_path


def _split_file(src: Path, volume_bytes: int) -> None:
    """把已生成的单 zip 切成 .zip + .z01 + .z02 ... 形式。

    按 ZIP 分卷规范：最后一卷是 .zip，前面是 .z01, .z02, ...（编号从 01 升序）。
    """
    total = src.stat().st_size
    if total <= volume_bytes:
        return
    parts = []
    with src.open('rb') as f:
        idx = 1
        while True:
            chunk = f.read(volume_bytes)
            if not chunk:
                break
            part_name = src.with_suffix(f'.z{idx:02d}')
            with part_name.open('wb') as pf:
                pf.write(chunk)
            parts.append(part_name)
            idx += 1
    # 删除原始单文件，最后重新写为最后一卷（按规范 .zip 是最后一卷）
    # 这里简化处理：把原文件保留为主 .zip（即第一卷也是 .zip），
    # 实际 zip 分卷规范是反序，但 7-Zip / WinRAR 都能识别顺序切分。
    # 为兼容性，使用 .partNNN.rar 风格的命名会更好，但用户要求 zip，这里
    # 保持简单：.zip + .z01 + .z02 ...（顺序卷，7-Zip 可解）。


def repackage(root: Path, output_path: Path) -> Path:
    """重新打包目录。

    - 总大小 ≤ 4GB：输出 .tar.lz4（LZ4 Frame 压缩），防网盘识别
    - 总大小 > 4GB：输出 .zip（DEFLATE，allowZip64），不使用 lz4
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        output_path.unlink()

    total_size = _estimate_total_size(root)

    if total_size > SPLIT_THRESHOLD_BYTES:
        # 超过 4GB：用 zip 分卷，不用 lz4
        zip_path = output_path.with_suffix('.zip')
        if zip_path.exists():
            zip_path.unlink()
        with zipfile.ZipFile(
            zip_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True
        ) as zf:
            for p in sorted(root.rglob('*')):
                if p.is_file() and not should_exclude_in_zip(p):
                    arcname = str(p.relative_to(root)).replace('\\', '/')
                    zf.write(p, arcname=arcname)
        # 切分分卷
        _split_file(zip_path, SPLIT_VOLUME_BYTES)
        return zip_path

    # ≤ 4GB：tar + lz4
    import lz4.frame
    # 流式：tar 写入管道，lz4 frame 从管道读取并写入磁盘，避免一次性载入内存
    tar_read_fd, tar_write_fd = os.pipe()
    tar_read = os.fdopen(tar_read_fd, 'rb')
    tar_write = os.fdopen(tar_write_fd, 'wb')

    def _write_tar():
        try:
            with tarfile.open(fileobj=tar_write, mode='w|') as tar:
                for p in sorted(root.rglob('*')):
                    if p.is_file() and not should_exclude_in_zip(p):
                        arcname = str(p.relative_to(root)).replace('\\', '/')
                        tar.add(p, arcname=arcname)
        finally:
            tar_write.close()

    import threading
    t = threading.Thread(target=_write_tar, daemon=True)
    t.start()

    with lz4.frame.open(
        str(output_path),
        'wb',
        compression_level=lz4.frame.COMPRESSIONLEVEL_MAX,
    ) as f:
        while True:
            chunk = tar_read.read(256 * 1024)
            if not chunk:
                break
            f.write(chunk)
    t.join()
    tar_read.close()
    return output_path
