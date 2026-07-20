from __future__ import annotations

from PyQt5.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, QPushButton,
    QListWidget, QListWidgetItem, QAbstractItemView, QWidget, QFrame,
)
from PyQt5.QtCore import Qt, QSize
from PyQt5.QtGui import QFont, QColor


class CoserListDialog(QDialog):
    """显示 coser 列表，可搜索、可点选填入主窗口。"""

    def __init__(self, cosplayers: list[dict], parent=None):
        super().__init__(parent)
        self.setWindowTitle('Coser 列表')
        self.resize(420, 560)
        self.setAttribute(Qt.WA_StyledBackground, True)
        self.setObjectName('SettingsDialog')
        self._all = cosplayers
        self._selected_name = ''

        self._build_ui()
        self._populate('')

    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 14, 16, 14)
        layout.setSpacing(10)

        header = QHBoxLayout()
        header.setSpacing(8)
        title = QLabel(f'Coser 列表（{len(self._all)}）')
        title.setObjectName('settingsSection')
        title.setFont(QFont('Segoe UI', 11, QFont.Bold))
        header.addWidget(title)
        header.addStretch()
        layout.addLayout(header)

        hint = QLabel('双击选中可填入主窗口；下方可搜索过滤')
        hint.setObjectName('fieldHint')
        layout.addWidget(hint)

        self.search_edit = QLineEdit()
        self.search_edit.setPlaceholderText('搜索 coser 名称...')
        self.search_edit.setMinimumHeight(32)
        self.search_edit.textChanged.connect(self._on_search)
        layout.addWidget(self.search_edit)

        self.list_widget = QListWidget()
        self.list_widget.setObjectName('coserList')
        self.list_widget.setSelectionMode(QAbstractItemView.SingleSelection)
        self.list_widget.itemDoubleClicked.connect(self._on_item_double_click)
        layout.addWidget(self.list_widget, 1)

        btn_row = QHBoxLayout()
        btn_row.setSpacing(8)
        btn_row.addStretch()

        self.cancel_btn = QPushButton('取消')
        self.cancel_btn.setObjectName('ghostBtn')
        self.cancel_btn.setMinimumHeight(32)
        self.cancel_btn.clicked.connect(self.reject)
        btn_row.addWidget(self.cancel_btn)

        self.use_btn = QPushButton('使用选中')
        self.use_btn.setObjectName('primaryBtn')
        self.use_btn.setMinimumHeight(32)
        self.use_btn.clicked.connect(self._on_use)
        btn_row.addWidget(self.use_btn)

        layout.addLayout(btn_row)

    def _populate(self, filter_text: str):
        self.list_widget.clear()
        flt = filter_text.strip().lower()
        for c in self._all:
            name = c.get('name', '')
            count = c.get('galleryCount', 0)
            if flt and flt not in name.lower():
                continue
            item = QListWidgetItem()
            item.setText(f'{name}   ·   {count} 个图包')
            item.setData(Qt.UserRole, name)
            self.list_widget.addItem(item)

    def _on_search(self, text: str):
        self._populate(text)

    def _on_item_double_click(self, item: QListWidgetItem):
        self._selected_name = item.data(Qt.UserRole) or ''
        self.accept()

    def _on_use(self):
        items = self.list_widget.selectedItems()
        if items:
            self._selected_name = items[0].data(Qt.UserRole) or ''
            self.accept()

    def selected_name(self) -> str:
        return self._selected_name
