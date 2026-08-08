"""调用 cosplay 后台 admin API 创建图包。"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
import re
import time
import requests

from config import AppConfig


def _session() -> 'requests.Session':
    """
    直连会话：忽略系统代理（trust_env=False）。

    桌面发布工具直接连后台 / 翻译接口。若系统残留了坏代理
    （HTTP(S)_PROXY 指向不可达地址），requests 默认会走代理，
    导致 ProxyError / 连接被拒。这里强制直连，避免坏代理阻断发布。
    """
    s = requests.Session()
    s.trust_env = False
    return s


# ── 微软 Edge 内置翻译接口（edge.microsoft.com，免密钥） ──
_EDGE_URL = 'https://edge.microsoft.com/translate/translatetext'
_EDGE_HEADERS = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    'Origin': 'https://www.microsoft.com',
    'Referer': 'https://www.microsoft.com/',
}
# Edge 翻译语言代码（与 Microsoft Translator 一致）
_EDGE_LANG = {'zh': 'zh-Hans', 'en': 'en', 'ja': 'ja'}


@dataclass
class GalleryPayload:
    slug: str
    titleZh: str
    titleEn: str = ''
    titleJa: str = ''
    descriptionZh: str = ''
    descriptionEn: str = ''
    descriptionJa: str = ''
    cosplayer: str = ''
    character: str = ''
    series: str = ''
    cover: str = ''
    images: list[str] = field(default_factory=list)
    categories: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    rating: str = 'sfw'
    price: float = 0
    isPremium: bool = False
    downloadUrl: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            'slug': self.slug,
            'titleZh': self.titleZh,
            'titleEn': self.titleEn,
            'titleJa': self.titleJa,
            'descriptionZh': self.descriptionZh,
            'descriptionEn': self.descriptionEn,
            'descriptionJa': self.descriptionJa,
            'cosplayer': self.cosplayer,
            'character': self.character,
            'series': self.series,
            'cover': self.cover,
            'images': self.images,
            'categories': self.categories,
            'tags': self.tags,
            'rating': self.rating,
            'price': self.price,
            'isPremium': self.isPremium,
            'downloadUrl': self.downloadUrl,
        }


def fetch_categories(config: AppConfig) -> list[dict]:
    """从 cosplay 后台拉取分类列表。"""
    url = config.cosplay_base_url.rstrip('/') + '/admin/api/categories'
    cookies = {'admin_token': config.cosplay_admin_token}
    with _session() as s:
        resp = s.get(url, cookies=cookies, timeout=15)
    if resp.status_code == 401:
        raise RuntimeError('admin token 无效')
    resp.raise_for_status()
    data = resp.json()
    return data.get('items', []) if isinstance(data, dict) else data


def fetch_cosplayers(config: AppConfig) -> list[dict]:
    """从 cosplay 后台聚合拉取所有出现过的 coser 名单（带图包数）。"""
    url = config.cosplay_base_url.rstrip('/') + '/admin/api/cosplayers'
    cookies = {'admin_token': config.cosplay_admin_token}
    with _session() as s:
        resp = s.get(url, cookies=cookies, timeout=15)
    if resp.status_code == 401:
        raise RuntimeError('admin token 无效')
    resp.raise_for_status()
    data = resp.json()
    return data.get('items', []) if isinstance(data, dict) else data


def fetch_series(config: AppConfig) -> list[dict]:
    """
    从 cosplay 后台聚合拉取所有出现过的系列，及其绑定的角色列表。
    返回 [{'series': str, 'galleryCount': int, 'characters': [str, ...]}, ...]，
    characters 按在该系列中出现频次降序。
    """
    url = config.cosplay_base_url.rstrip('/') + '/admin/api/series'
    cookies = {'admin_token': config.cosplay_admin_token}
    with _session() as s:
        resp = s.get(url, cookies=cookies, timeout=15)
    if resp.status_code == 401:
        raise RuntimeError('admin token 无效')
    resp.raise_for_status()
    data = resp.json()
    items = data.get('items', []) if isinstance(data, dict) else []
    return [
        {
            'series': it.get('series', ''),
            'galleryCount': it.get('galleryCount', 0),
            'characters': it.get('characters', []) or [],
        }
        for it in items
    ]


def fetch_characters(config: AppConfig) -> list[dict]:
    """
    从 cosplay 后台聚合拉取所有出现过的角色（带图包数），用于「未选系列」时的兜底候选。
    返回 [{'name': str, 'galleryCount': int}, ...]。
    """
    url = config.cosplay_base_url.rstrip('/') + '/admin/api/series'
    cookies = {'admin_token': config.cosplay_admin_token}
    with _session() as s:
        resp = s.get(url, cookies=cookies, timeout=15)
    if resp.status_code == 401:
        raise RuntimeError('admin token 无效')
    resp.raise_for_status()
    data = resp.json()
    chars = data.get('allCharacters', []) if isinstance(data, dict) else []
    return [
        {'name': c.get('name', ''), 'galleryCount': c.get('galleryCount', 0)}
        for c in chars
    ]


def publish_gallery(payload: GalleryPayload, config: AppConfig) -> dict:
    """POST /admin/api/galleries 创建图包，返回后端响应。"""
    if not config.cosplay_base_url or not config.cosplay_admin_token:
        raise RuntimeError('请先在设置中配置 cosplay 后台地址和 admin token')

    url = config.cosplay_base_url.rstrip('/') + '/admin/api/galleries'
    cookies = {'admin_token': config.cosplay_admin_token}
    headers = {'Content-Type': 'application/json'}

    with _session() as s:
        resp = s.post(
            url,
            json=payload.to_dict(),
            cookies=cookies,
            headers=headers,
            timeout=30,
        )

    if resp.status_code == 401:
        raise RuntimeError('admin token 无效')
    if resp.status_code == 409:
        raise RuntimeError('该 slug 已存在，请修改 Slug')
    if resp.status_code >= 400:
        try:
            data = resp.json()
            raise RuntimeError(data.get('error', f'HTTP {resp.status_code}'))
        except ValueError:
            raise RuntimeError(f'HTTP {resp.status_code}: {resp.text[:200]}')

    return resp.json()


def gallery_url(slug: str, config: AppConfig) -> str:
    return config.cosplay_base_url.rstrip('/') + f'/{slug}'


# Slug 生成：把任意文字转成 a-z0-9- 形式
def generate_slug(text: str) -> str:
    import re
    import unicodedata
    # 把中文等转为拼音化的近似（简化：去掉非 ASCII，保留连字符）
    text = unicodedata.normalize('NFKD', text)
    text = text.encode('ascii', 'ignore').decode('ascii')
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    text = text.strip('-')
    if not text:
        text = 'gallery'
    return text


# ── 自动 Slug（参考后台 src/lib/gallery-helpers.ts 的 autoSlug 逻辑） ──

_CJK_RE = re.compile(r'[一-鿿぀-ヿ가-힯]')


def has_cjk(s: str) -> bool:
    return bool(_CJK_RE.search(s or ''))


def translate_text(text: str, from_lang: str, to_lang: str, timeout: int = 8) -> str | None:
    """
    调用微软 Edge 内置翻译接口（edge.microsoft.com，免密钥）把文本翻译。
    from_lang / to_lang 取 'zh' | 'en' | 'ja'。
    返回翻译结果；失败（网络/5xx/限流）返回 None，由上层走文件名兜底。
    """
    q = (text or '').strip()
    if not q or from_lang == to_lang:
        return None
    if len(q) > 1000:  # 单次长度保护
        return None
    src = _EDGE_LANG.get(from_lang, from_lang)
    dst = _EDGE_LANG.get(to_lang, to_lang)
    params = {'from': src, 'to': dst, 'api-version': '3.0'}
    last_err = None
    for attempt in range(3):  # 重试应对偶发 5xx / 网络抖动（接口免费、会限流）
        try:
            with _session() as s:
                resp = s.post(
                    _EDGE_URL, params=params, json=[q],
                    headers=_EDGE_HEADERS, timeout=timeout,
                )
            if resp.status_code != 200:
                last_err = f'HTTP {resp.status_code}'
                continue
            data = resp.json()
            # 响应形如 [{"translations":[{"text": "...", "to": "..."}]}]
            if isinstance(data, list) and data:
                trans = data[0].get('translations', [{}])[0].get('text')
                if isinstance(trans, str) and trans.strip():
                    return trans.strip()
            last_err = 'empty translation'
        except Exception as e:
            last_err = str(e)
        if attempt < 2:
            time.sleep(0.4 * (attempt + 1))
    return None


def auto_slug(title_zh: str, title_en: str, title_ja: str = '', fallback_base: str = '') -> tuple[str, str]:
    """
    返回 (slug, en_title)。
    1. 英文标题是拉丁文 → 直接 slugify
    2. 日文标题是拉丁文（romaji）→ 直接 slugify
    3. 有中文 → 翻译成英文再 slugify
    4. 有日文 → 翻译成英文再 slugify
    5. 翻译全失败 → 退回用原始文件名（通常含罗马音/英文）生成 slug
    全失败时返回 ('', '')。
    """
    en = (title_en or '').strip()
    ja = (title_ja or '').strip()
    zh = (title_zh or '').strip()

    if en and not has_cjk(en):
        return generate_slug(en), ''
    if ja and not has_cjk(ja):
        return generate_slug(ja), ''

    if zh:
        en_title = translate_text(zh, 'zh', 'en')
        if en_title:
            slug = generate_slug(en_title)
            if slug and slug != 'gallery':
                return slug, en_title
    if ja:
        en_title = translate_text(ja, 'ja', 'en')
        if en_title:
            slug = generate_slug(en_title)
            if slug and slug != 'gallery':
                return slug, en_title
    # 兜底：翻译配额耗尽 / 网络失败时，用原始文件名生成 slug，避免发布被卡死
    if fallback_base:
        slug = generate_slug(fallback_base)
        if slug and slug != 'gallery':
            return slug, ''
    return '', ''
