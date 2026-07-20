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
