"""
压缩包标题解析器。

典型格式：
    星之迟迟 NO.364 森亚露露卡 [123P-436.37 MB] #20260717e
    └──┬──┘ └─┬─┘ └──┬───┘ └────┬──────┘ └────┬───┘
      coser  序号   角色    图片数+大小      标识

解析规则：
1. 去掉 [xxx] 方括号内容（图片数、大小、其他元信息）
2. 去掉 #xxx 标识
3. 去掉 NO.xxx 序号（大小写不敏感，数字或数字+字母）
4. 剩余部分按空白拆分，前半段为 coser，后半段为角色
5. 处理 "coser@角色" / "coser - 角色" / "coser 角色限定词" 等变体
"""
from __future__ import annotations
import re
from dataclasses import dataclass


# 需要剥离的杂项模式
BRACKET_RE = re.compile(r'\[[^\]]*\]')          # [123P-436.37 MB]
HASHTAG_RE = re.compile(r'#[A-Za-z0-9]+')        # #20260717e
NO_RE = re.compile(r'\bNO\.?\s*\d+[A-Za-z]?\b', re.IGNORECASE)  # NO.364 / NO364A
PARENTHESES_RE = re.compile(r'\([^)]*\)')        # (xxx)
# 没有方括号包裹的裸 "50P" / "123P" 图片数量
BARE_PCOUNT_RE = re.compile(r'\b\d+\s*P\b', re.IGNORECASE)
# 裸的大小标识 "436.37MB" / "100 MB"
BARE_SIZE_RE = re.compile(r'\b\d+(?:\.\d+)?\s*(?:MB|GB|KB)\b', re.IGNORECASE)
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

    # 1. 移除括号内容
    s = BRACKET_RE.sub(' ', stem)
    s = PARENTHESES_RE.sub(' ', s)

    # 2. 移除 #标识
    s = HASHTAG_RE.sub(' ', s)

    # 3. 移除 NO.xxx 序号
    s = NO_RE.sub(' ', s)

    # 3.5 移除裸的图片数量和大小标识
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
