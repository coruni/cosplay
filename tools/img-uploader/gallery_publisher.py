"""调用 cosplay 后台 admin API 创建图包。"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
import re
import requests

from config import AppConfig


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
    resp = requests.get(url, cookies=cookies, timeout=15)
    if resp.status_code == 401:
        raise RuntimeError('admin token 无效')
    resp.raise_for_status()
    data = resp.json()
    return data.get('items', []) if isinstance(data, dict) else data


def fetch_cosplayers(config: AppConfig) -> list[dict]:
    """从 cosplay 后台聚合拉取所有出现过的 coser 名单（带图包数）。"""
    url = config.cosplay_base_url.rstrip('/') + '/admin/api/cosplayers'
    cookies = {'admin_token': config.cosplay_admin_token}
    resp = requests.get(url, cookies=cookies, timeout=15)
    if resp.status_code == 401:
        raise RuntimeError('admin token 无效')
    resp.raise_for_status()
    data = resp.json()
    return data.get('items', []) if isinstance(data, dict) else data


def publish_gallery(payload: GalleryPayload, config: AppConfig) -> dict:
    """POST /admin/api/galleries 创建图包，返回后端响应。"""
    if not config.cosplay_base_url or not config.cosplay_admin_token:
        raise RuntimeError('请先在设置中配置 cosplay 后台地址和 admin token')

    url = config.cosplay_base_url.rstrip('/') + '/admin/api/galleries'
    cookies = {'admin_token': config.cosplay_admin_token}
    headers = {'Content-Type': 'application/json'}

    resp = requests.post(
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
    调用 MyMemory 免费翻译 API（与后台保持一致）。
    from_lang / to_lang 取 'zh' | 'en' | 'ja'。
    返回翻译结果；失败返回 None。
    """
    q = (text or '').strip()
    if not q or from_lang == to_lang:
        return None
    if len(q) > 400:  # 免费 API 限制
        return None
    mm_code = {'zh': 'zh-CN', 'en': 'en', 'ja': 'ja'}
    src = mm_code.get(from_lang, from_lang)
    dst = mm_code.get(to_lang, to_lang)
    url = 'https://api.mymemory.translated.net/get'
    params = {'q': q, 'langpair': f'{src}|{dst}'}
    try:
        resp = requests.get(url, params=params, timeout=timeout)
        if resp.status_code != 200:
            return None
        data = resp.json()
        t = data.get('responseData', {}).get('translatedText')
        if isinstance(t, str) and not t.startswith('MYMEMORY WARNING'):
            return t.strip()
    except Exception:
        pass
    return None


def auto_slug(title_zh: str, title_en: str, title_ja: str = '') -> tuple[str, str]:
    """
    返回 (slug, en_title)。
    1. 英文标题是拉丁文 → 直接 slugify
    2. 日文标题是拉丁文（romaji）→ 直接 slugify
    3. 有中文 → 翻译成英文再 slugify
    4. 有日文 → 翻译成英文再 slugify
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
    return '', ''
