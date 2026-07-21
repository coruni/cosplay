from pathlib import Path
import json


CONFIG_DIR = Path.home() / '.coshub_publisher'
CONFIG_FILE = CONFIG_DIR / 'config.json'


class AppConfig:
    def __init__(self):
        # Chevereto 图床
        self.api_url = ''
        self.api_key = ''
        self.host_name = 'Chevereto'
        self.default_nsfw = False

        # cosplay 后台
        self.cosplay_base_url = 'http://localhost:3000'
        self.cosplay_admin_token = ''

        # 图片压缩
        self.compress_enabled = True
        self.compress_quality = 85
        self.compress_max_width = 1920
        self.compress_format = 'JPEG'
        self.concurrent_uploads = 3

        # 打包
        self.output_dir = str(Path.home() / 'Documents' / 'CoshubPackages')
        self.temp_dir = str(Path.home() / '.coshub_publisher' / 'temp')

        # 清理规则
        self.clean_exclude_exts = ['.txt', '.url', '.html', '.htm', '.lnk', '.exe', '.db']
        self.clean_exclude_names = ['Thumbs.db', '.DS_Store']
        self.auto_clean_non_image = True

        # 上传后自动发布
        self.auto_publish = True

        # 解压密码列表（自动尝试）
        self.archive_passwords: list[str] = []

        # Telegram Bot (Telethon / MTProto)
        self.tg_api_id = ''
        self.tg_api_hash = ''
        self.tg_bot_token = ''
        self.tg_session_name = 'coshub_publisher'  # session 文件名（无扩展名）
        self.tg_allowed_chat_ids: list[int] = []
        self.tg_enabled = False  # GUI 启动时是否自动启动 bot
        self.tg_default_rating = 'sfw'  # 自动发布的默认分级
        self.tg_default_price = 0
        self.tg_default_premium = False
        # 代理（telethon 连不上 Telegram 时用，国内必填）
        self.tg_proxy_type = ''  # 'socks5' / 'http' / ''
        self.tg_proxy_host = ''
        self.tg_proxy_port = 0
        self.tg_proxy_username = ''
        self.tg_proxy_password = ''

    def build_tg_proxy(self):
        """构造 telethon 接受的 proxy 元组，未配置返回 None。"""
        if not self.tg_proxy_type or not self.tg_proxy_host or not self.tg_proxy_port:
            return None
        if self.tg_proxy_username or self.tg_proxy_password:
            return (
                self.tg_proxy_type,
                self.tg_proxy_host,
                int(self.tg_proxy_port),
                True,
                self.tg_proxy_username,
                self.tg_proxy_password,
            )
        return (self.tg_proxy_type, self.tg_proxy_host, int(self.tg_proxy_port))

    def load(self):
        if CONFIG_FILE.exists():
            try:
                data = json.loads(CONFIG_FILE.read_text(encoding='utf-8'))
                for k, v in data.items():
                    if hasattr(self, k):
                        setattr(self, k, v)
            except Exception:
                pass
        return self

    def save(self):
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        data = {k: v for k, v in self.__dict__.items() if not k.startswith('_')}
        CONFIG_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')

    @property
    def output_path(self) -> Path:
        return Path(self.output_dir).expanduser()

    @property
    def temp_path(self) -> Path:
        return Path(self.temp_dir).expanduser()
