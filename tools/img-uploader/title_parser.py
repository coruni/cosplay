"""
压缩包标题解析器。

典型格式：
    星之迟迟 NO.364 森亚露露卡 [123P-436.37 MB] #20260717e
    └──┬──┘ └─┬─┘ └──┬───┘ └────┬──────┘ └────┬───┘
      coser  序号   角色    图片数+大小      标识

下划线变体：
    #星之迟迟_NO_364_森亚露露卡_123P_436_37_MB_#20260717e
       └──┬──┘ └─┬──┘ └──┬───┘ └┬─┘ └──┬────┘ └────┬───┘
        coser  序号    角色  图片数   大小        标识

解析规则：
1. 去掉开头的 # 前缀标识
2. 去掉 [xxx] 方括号内容（图片数、大小、其他元信息）
3. 去掉 #xxx 标识（仅匹配 ASCII，避免误删中文 # 前缀）
4. 去掉 NO.xxx 序号（支持 NO.364 / NO_364 / NO 364，大小写不敏感）
5. 去掉裸的图片数量 "50P" / "123P"（_ 与空白均视作分界）
6. 去掉裸的大小标识 "436.37MB" / "436_37_MB" / "100 MB"
7. 剩余部分按强分隔符拆分，前半段为 coser，后半段为角色
8. 处理 "coser@角色" / "coser - 角色" / "coser 角色限定词" 等变体
"""
from __future__ import annotations
import re
from dataclasses import dataclass


# 需要剥离的杂项模式
BRACKET_RE = re.compile(r'\[[^\]]*\]')          # [123P-436.37 MB]
PARENTHESES_RE = re.compile(r'\([^)]*\)')        # (xxx)
# 开头的 # 前缀（如 #星之迟迟_NO_364...）
LEADING_HASH_RE = re.compile(r'^#+\s*')
# #xxx 标识：仅匹配 # 后跟 ASCII 字母/数字（如 #20260717e），不会匹配 #中文
HASHTAG_RE = re.compile(r'#[A-Za-z0-9]+')
# NO.xxx 序号：支持 NO.364 / NO_364 / NO 364 / NO364，前后不能紧邻字母或数字
NO_RE = re.compile(r'(?<![A-Za-z0-9])NO[._\s]*\d+[A-Za-z]?(?![A-Za-z0-9])', re.IGNORECASE)
# 裸图片数量 "50P" / "123P"，前后用 _ / 空白 / 字符串边界作分界（\b 不行，_ 算 word 字符）
BARE_PCOUNT_RE = re.compile(r'(?:^|(?<=[_\s]))\d+\s*P(?=[_\s]|$)', re.IGNORECASE)
# 裸大小 "436.37MB" / "436_37_MB" / "100 MB"，小数分隔支持 . 或 _
BARE_SIZE_RE = re.compile(r'\d+(?:[._]\d+)?[_\s]*(?:MB|GB|KB)(?![A-Za-z])', re.IGNORECASE)
MULTISPACE_RE = re.compile(r'\s+')

# 分隔符（用于拆 coser / 角色）
SEPARATOR_RE = re.compile(r'[@\-—–_\/|]')


@dataclass
class ParsedTitle:
    cosplayer: str = ''
    character: str = ''
    clean_title: str = ''  # 形如 "星之迟迟 森亚露露卡"


def parse_archive_title(filename: str) -> ParsedTitle:
    """
    从压缩包文件名（不带扩展名）解析出 coser 和角色名。
    """
    # 去扩展名
    stem = filename
    for ext in ('.zip', '.rar', '.7z'):
        if stem.lower().endswith(ext):
            stem = stem[:-len(ext)]
            break

    # 1. 移除开头 # 前缀（如 "#星之迟迟_NO_364..."）
    s = LEADING_HASH_RE.sub(' ', stem)

    # 2. 移除括号内容
    s = BRACKET_RE.sub(' ', s)
    s = PARENTHESES_RE.sub(' ', s)

    # 3. 移除 #xxx 标识（仅 ASCII，不会误删中文 # 前缀）
    s = HASHTAG_RE.sub(' ', s)

    # 4. 移除 NO.xxx 序号
    s = NO_RE.sub(' ', s)

    # 5. 移除裸的图片数量和大小标识
    s = BARE_PCOUNT_RE.sub(' ', s)
    s = BARE_SIZE_RE.sub(' ', s)

    # 4. 规范化空白
    s = MULTISPACE_RE.sub(' ', s).strip()

    if not s:
        return ParsedTitle()

    # 5. 尝试用强分隔符拆分（@、-、_等）
    parts = SEPARATOR_RE.split(s)
    parts = [p.strip() for p in parts if p.strip()]

    if len(parts) >= 2:
        coser = parts[0]
        char = ' '.join(parts[1:])
    else:
        # 没有强分隔符，按空白拆成前后两段
        tokens = s.split()
        if len(tokens) >= 2:
            # 第一段当 coser，剩余合并为角色
            coser = tokens[0]
            char = ' '.join(tokens[1:])
        else:
            # 只有一段，全部当角色，coser 留空
            coser = ''
            char = s

    # 清理首尾可能残留的标点
    coser = coser.strip(' -—–_@|')
    char = char.strip(' -—–_@|')

    clean_title = f'{coser} {char}'.strip() if coser and char else (coser or char)

    return ParsedTitle(cosplayer=coser, character=char, clean_title=clean_title)


def generate_slug_from_parsed(parsed: ParsedTitle) -> str:
    """根据解析结果生成 slug。中文会保留原样（slug 校验只允许 a-z0-9-，所以中文 slug 在后端会失败）。
    实际使用时建议手填英文 slug。"""
    # 这里只做简单的占位，主要逻辑在 gallery_publisher.generate_slug
    import unicodedata
    text = parsed.clean_title
    text = unicodedata.normalize('NFKD', text)
    text = text.encode('ascii', 'ignore').decode('ascii')
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    text = text.strip('-')
    return text or 'gallery'
