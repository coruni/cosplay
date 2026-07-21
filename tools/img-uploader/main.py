import sys
import traceback
from pathlib import Path

from PyQt5.QtWidgets import QApplication
from PyQt5.QtCore import Qt

from config import AppConfig, CONFIG_DIR
from main_window import MainWindow


CRASH_LOG = CONFIG_DIR / 'crash.log'


def _install_excepthook():
    """全局异常钩子：把未捕获异常写入 crash.log，避免静默闪退。"""
    def hook(exctype, value, tb):
        text = ''.join(traceback.format_exception(exctype, value, tb))
        try:
            CONFIG_DIR.mkdir(parents=True, exist_ok=True)
            with CRASH_LOG.open('a', encoding='utf-8') as f:
                from datetime import datetime
                f.write(f'\n==== {datetime.now().isoformat()} ====\n')
                f.write(text)
        except Exception:
            pass
        sys.__excepthook__(exctype, value, tb)
    sys.excepthook = hook


def main():
    _install_excepthook()
    QApplication.setAttribute(Qt.AA_EnableHighDpiScaling, True)
    QApplication.setAttribute(Qt.AA_UseHighDpiPixmaps, True)

    app = QApplication(sys.argv)
    app.setApplicationName('CosHub Uploader')
    app.setOrganizationName('CosHub')

    config = AppConfig().load()
    window = MainWindow(config)
    window.show()
    sys.exit(app.exec_())


if __name__ == '__main__':
    main()
