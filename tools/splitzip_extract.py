#!/usr/bin/env python3
"""解压 zip -s 分卷包 (name.z01, name.z02, ..., name.zip)。

原理：zip -s 分卷就是把原 zip 按固定字节数顺序切成多段，
按 .z01 -> .z02 -> ... -> .zip 的顺序拼回就是完整 zip，
再用标准 zipfile 解即可。

用法:
  python splitzip_extract.py <任一卷路径或目录> [输出目录]

  - 给 .z01 / .zNN / .zip 任一卷路径，会自动找齐同前缀的所有卷
  - 只给目录则在该目录里找第一个分卷包
"""
import os
import re
import sys
import tempfile
import zipfile


def find_volumes(first_path: str):
    """根据任一卷路径，返回按正确顺序排好的卷文件列表。"""
    p = os.path.abspath(first_path)
    if os.path.isdir(p):
        files = sorted(os.listdir(p))
        cand = next((f for f in files
                     if re.search(r"\.z\d{2,3}$", f) or f.endswith(".zip")), None)
        if not cand:
            raise SystemExit(f"目录 {p} 里没找到分卷 zip")
        p = os.path.join(p, cand)

    base, ext = os.path.splitext(p)
    if ext == ".zip":
        base = base
    elif re.match(r"\.z\d{2,3}$", ext):
        base = base
    else:
        raise SystemExit(f"无法识别的卷扩展名: {ext}")

    volumes = []
    i = 1
    while True:
        vp = f"{base}.z{i:02d}"
        if os.path.exists(vp):
            volumes.append(vp)
            i += 1
        else:
            break
    if not volumes:  # 兜底 3 位编号
        i = 1
        while True:
            vp = f"{base}.z{i:03d}"
            if os.path.exists(vp):
                volumes.append(vp)
                i += 1
            else:
                break
    last = f"{base}.zip"
    if not os.path.exists(last):
        raise SystemExit(f"找不到最后的 .zip 卷: {last}")
    volumes.append(last)
    if not volumes:
        raise SystemExit("没找到任何分卷")
    return volumes


def extract(first_path: str, out_dir: str = None):
    volumes = find_volumes(first_path)
    print(f"找到 {len(volumes)} 个卷:")
    for v in volumes:
        print(f"  {v}  ({os.path.getsize(v)} bytes)")

    tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    tmp_path = tmp.name
    tmp.close()
    try:
        with open(tmp_path, "wb") as out:
            for v in volumes:
                with open(v, "rb") as f:
                    while True:
                        chunk = f.read(1024 * 1024)
                        if not chunk:
                            break
                        out.write(chunk)
        print(f"合卷完成 -> {tmp_path}")

        if not zipfile.is_zipfile(tmp_path):
            raise SystemExit("合卷后不是合法 zip，可能卷顺序或文件有误")

        out_dir = out_dir or os.path.join(os.getcwd(), "extracted")
        os.makedirs(out_dir, exist_ok=True)
        with zipfile.ZipFile(tmp_path) as z:
            bad = z.testzip()
            if bad is not None:
                raise SystemExit(f"zip 校验失败，坏文件: {bad}")
            z.extractall(out_dir)
            names = z.namelist()
        print(f"解压成功，共 {len(names)} 个条目 -> {out_dir}")
        return out_dir, names
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        raise SystemExit(1)
    extract(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
