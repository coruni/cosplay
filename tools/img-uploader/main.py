import sys

from PyQt5.QtWidgets import QApplication
from PyQt5.QtCore import Qt

from config import AppConfig
from main_window import MainWindow


def main():
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
