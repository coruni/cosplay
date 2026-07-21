from __future__ import annotations
from pathlib import Path

from PyQt5.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, QPushButton,
    QCheckBox, QSpinBox, QComboBox, QScrollArea, QWidget, QFrame,
    QPlainTextEdit, QFileDialog,
)
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QFont

from config import AppConfig


class SettingsDialog(QDialog):
    def __init__(self, config: AppConfig, parent=None):
        super().__init__(parent)
        self.config = config
        self.setWindowTitle('设置')
        self.setMinimumWidth(560)
        self.setMinimumHeight(640)
        self.setAttribute(Qt.WA_StyledBackground, True)
        self.setObjectName('SettingsDialog')
        self._build_ui()
        self._load_values()

    def _build_ui(self):
        main = QVBoxLayout(self)
        main.setContentsMargins(0, 0, 0, 0)
        main.setSpacing(0)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)
        scroll.setObjectName('SettingsScroll')

        content = QWidget()
        content.setObjectName('SettingsContent')
        layout = QVBoxLayout(content)
        layout.setContentsMargins(24, 20, 24, 20)
        layout.setSpacing(16)

        # ─── Chevereto 图床 ───
        layout.addWidget(self._section('Chevereto 图床'))
        self.api_url_edit = QLineEdit()
        self.api_url_edit.setPlaceholderText('https://your-chevereto.com/api/1/upload')
        layout.addWidget(self._labeled('API URL', self.api_url_edit, '完整上传接口地址，或仅填域名（自动补 /api/1/upload）'))

        self.api_key_edit = QLineEdit()
        self.api_key_edit.setEchoMode(QLineEdit.Password)
        self.api_key_edit.setPlaceholderText('X-API-Key')
        layout.addWidget(self._labeled('API Key', self.api_key_edit, 'Chevereto 的 API 密钥'))

        self.host_name_edit = QLineEdit()
        self.host_name_edit.setPlaceholderText('Chevereto')
        layout.addWidget(self._labeled('显示名称', self.host_name_edit, '在界面上显示的图床名称'))

        self.default_nsfw_cb = QCheckBox('默认标记为 NSFW')
        layout.addWidget(self.default_nsfw_cb)

        # ─── cosplay 后台 ───
        layout.addWidget(self._section('cosplay 后台'))
        self.base_url_edit = QLineEdit()
        self.base_url_edit.setPlaceholderText('http://localhost:3000')
        layout.addWidget(self._labeled('后台地址', self.base_url_edit, 'cosplay 项目部署地址'))

        self.admin_token_edit = QLineEdit()
        self.admin_token_edit.setEchoMode(QLineEdit.Password)
        self.admin_token_edit.setPlaceholderText('admin token (ADMIN_TOKEN 环境变量)')
        layout.addWidget(self._labeled('Admin Token', self.admin_token_edit, '后台登录用的 token，对应 .env 中的 ADMIN_TOKEN'))

        self.auto_publish_cb = QCheckBox('上传完成后自动发布到后台')
        layout.addWidget(self.auto_publish_cb)

        # ─── 图片压缩 ───
        layout.addWidget(self._section('图片压缩'))
        self.compress_enabled_cb = QCheckBox('启用图片压缩')
        layout.addWidget(self.compress_enabled_cb)

        self.compress_format_combo = QComboBox()
        self.compress_format_combo.addItems(['JPEG', 'PNG', 'WEBP'])
        layout.addWidget(self._labeled('输出格式', self.compress_format_combo, '压缩后图片格式'))

        self.compress_quality_spin = QSpinBox()
        self.compress_quality_spin.setRange(10, 100)
        self.compress_quality_spin.setSuffix(' %')
        layout.addWidget(self._labeled('压缩质量', self.compress_quality_spin, '数值越高质量越好'))

        self.compress_maxw_spin = QSpinBox()
        self.compress_maxw_spin.setRange(0, 7680)
        self.compress_maxw_spin.setSuffix(' px')
        self.compress_maxw_spin.setSingleStep(100)
        layout.addWidget(self._labeled('最大宽度', self.compress_maxw_spin, '超过此宽度将缩放，0 表示不限制'))

        self.concurrent_spin = QSpinBox()
        self.concurrent_spin.setRange(1, 10)
        layout.addWidget(self._labeled('并发上传数', self.concurrent_spin, '同时上传的图片数量'))

        # ─── 打包输出 ───
        layout.addWidget(self._section('打包输出'))
        out_row = QHBoxLayout()
        out_row.setSpacing(8)
        self.output_dir_edit = QLineEdit()
        self.output_dir_edit.setPlaceholderText('重打包 zip 输出目录')
        self.output_dir_edit.setMinimumHeight(36)
        out_row.addWidget(self.output_dir_edit, 1)
        self.browse_btn = QPushButton('浏览...')
        self.browse_btn.setObjectName('ghostBtn')
        self.browse_btn.setMinimumHeight(36)
        self.browse_btn.clicked.connect(self._on_browse_output)
        out_row.addWidget(self.browse_btn)
        layout.addLayout(out_row)

        # ─── 解压密码 ───
        layout.addWidget(self._section('解压密码'))
        self.archive_passwords_edit = QPlainTextEdit()
        self.archive_passwords_edit.setPlaceholderText('每行一个密码，遇到加密压缩包时按顺序尝试')
        pwd_box = self._labeled('密码列表', self.archive_passwords_edit, '每行一个密码，自动按顺序尝试解压加密的 zip/rar/7z')
        self.archive_passwords_edit.setMinimumHeight(80)
        layout.addWidget(pwd_box)

        # ─── 清理规则 ───
        layout.addWidget(self._section('清理规则'))
        self.auto_clean_cb = QCheckBox('自动删除非图片文件（解压后立即清理）')
        layout.addWidget(self.auto_clean_cb)

        self.exclude_exts_edit = QLineEdit()
        self.exclude_exts_edit.setPlaceholderText('.txt, .url, .html, .exe, .db')
        layout.addWidget(self._labeled('排除扩展名', self.exclude_exts_edit, '逗号分隔，匹配的文件会被删除'))

        self.exclude_names_edit = QLineEdit()
        self.exclude_names_edit.setPlaceholderText('Thumbs.db, .DS_Store')
        layout.addWidget(self._labeled('排除文件名', self.exclude_names_edit, '逗号分隔'))

        # ─── Telegram Bot ───
        layout.addWidget(self._section('Telegram Bot'))

        self.tg_enabled_cb = QCheckBox('GUI 启动时自动启动 Bot')
        layout.addWidget(self.tg_enabled_cb)

        self.tg_api_id_edit = QLineEdit()
        self.tg_api_id_edit.setPlaceholderText('12345')
        layout.addWidget(self._labeled('API ID', self.tg_api_id_edit, '在 https://my.telegram.org/apps 申请'))

        self.tg_api_hash_edit = QLineEdit()
        self.tg_api_hash_edit.setEchoMode(QLineEdit.Password)
        self.tg_api_hash_edit.setPlaceholderText('abcdef0123456789abcdef0123456789')
        layout.addWidget(self._labeled('API Hash', self.tg_api_hash_edit, '与 API ID 配对使用'))

        self.tg_token_edit = QLineEdit()
        self.tg_token_edit.setEchoMode(QLineEdit.Password)
        self.tg_token_edit.setPlaceholderText('123456:ABC-DEF...')
        layout.addWidget(self._labeled('Bot Token', self.tg_token_edit, '从 @BotFather 获取的 bot token'))

        self.tg_chats_edit = QLineEdit()
        self.tg_chats_edit.setPlaceholderText('123456789, 987654321')
        layout.addWidget(self._labeled('白名单 Chat ID', self.tg_chats_edit, '逗号分隔，留空表示接受所有 chat（不安全）'))

        self.tg_rating_combo = QComboBox()
        self.tg_rating_combo.addItem('SFW', 'sfw')
        self.tg_rating_combo.addItem('NSFW', 'nsfw')
        layout.addWidget(self._labeled('默认分级', self.tg_rating_combo, 'Bot 自动发布时使用的分级'))

        self.tg_price_spin = QSpinBox()
        self.tg_price_spin.setRange(0, 999999)
        self.tg_price_spin.setSuffix(' ¥')
        layout.addWidget(self._labeled('默认价格', self.tg_price_spin, '0 表示免费'))

        self.tg_premium_cb = QCheckBox('默认设为会员专享')
        layout.addWidget(self.tg_premium_cb)

        # ─── 代理 ───
        layout.addWidget(self._section('Telegram 代理（国内必填）'))

        self.tg_proxy_type_combo = QComboBox()
        self.tg_proxy_type_combo.addItem('不使用', '')
        self.tg_proxy_type_combo.addItem('SOCKS5', 'socks5')
        self.tg_proxy_type_combo.addItem('HTTP', 'http')
        layout.addWidget(self._labeled('代理类型', self.tg_proxy_type_combo, '国内连不上 Telegram 时使用'))

        proxy_row = QHBoxLayout()
        self.tg_proxy_host_edit = QLineEdit()
        self.tg_proxy_host_edit.setPlaceholderText('127.0.0.1')
        self.tg_proxy_port_edit = QLineEdit()
        self.tg_proxy_port_edit.setPlaceholderText('7890')
        self.tg_proxy_port_edit.setFixedWidth(80)
        proxy_row.addWidget(self._labeled('Host', self.tg_proxy_host_edit, ''))
        proxy_row.addWidget(self._labeled('Port', self.tg_proxy_port_edit, ''))
        layout.addLayout(proxy_row)

        proxy_auth_row = QHBoxLayout()
        self.tg_proxy_user_edit = QLineEdit()
        self.tg_proxy_user_edit.setPlaceholderText('（可选）用户名')
        self.tg_proxy_pass_edit = QLineEdit()
        self.tg_proxy_pass_edit.setEchoMode(QLineEdit.Password)
        self.tg_proxy_pass_edit.setPlaceholderText('（可选）密码')
        proxy_auth_row.addWidget(self._labeled('用户名', self.tg_proxy_user_edit, ''))
        proxy_auth_row.addWidget(self._labeled('密码', self.tg_proxy_pass_edit, ''))
        layout.addLayout(proxy_auth_row)

        # 提示：socks5 代理需要 python-socks 库
        hint = QLabel('提示：代理需要 python-socks 库（已包含在 requirements）')
        hint.setObjectName('fieldHint')
        layout.addWidget(hint)

        layout.addStretch()

        # ─── 按钮 ───
        btn_bar = QHBoxLayout()
        btn_bar.setContentsMargins(24, 12, 24, 20)
        btn_bar.setSpacing(8)
        btn_bar.addStretch()

        self.cancel_btn = QPushButton('取消')
        self.cancel_btn.setObjectName('ghostBtn')
        self.cancel_btn.setMinimumHeight(36)
        self.cancel_btn.clicked.connect(self.reject)
        btn_bar.addWidget(self.cancel_btn)

        self.save_btn = QPushButton('保存')
        self.save_btn.setObjectName('primaryBtn')
        self.save_btn.setMinimumHeight(36)
        self.save_btn.clicked.connect(self._on_save)
        btn_bar.addWidget(self.save_btn)

        scroll.setWidget(content)
        main.addWidget(scroll, 1)

        line = QFrame()
        line.setFrameShape(QFrame.HLine)
        line.setObjectName('divider')
        main.addWidget(line)
        main.addLayout(btn_bar)

    def _section(self, title: str) -> QLabel:
        lbl = QLabel(title)
        lbl.setObjectName('settingsSection')
        lbl.setFont(QFont('Segoe UI', 11, QFont.Bold))
        return lbl

    def _labeled(self, label: str, widget, hint: str = '') -> QWidget:
        box = QWidget()
        lay = QVBoxLayout(box)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(4)

        lbl = QLabel(label)
        lbl.setObjectName('fieldLabel')
        lay.addWidget(lbl)

        widget.setMinimumHeight(36)
        lay.addWidget(widget)

        if hint:
            hint_lbl = QLabel(hint)
            hint_lbl.setObjectName('fieldHint')
            lay.addWidget(hint_lbl)

        return box

    def _on_browse_output(self):
        d = QFileDialog.getExistingDirectory(self, '选择输出目录', self.output_dir_edit.text() or '')
        if d:
            self.output_dir_edit.setText(d)

    def _load_values(self):
        self.api_url_edit.setText(self.config.api_url)
        self.api_key_edit.setText(self.config.api_key)
        self.host_name_edit.setText(self.config.host_name)
        self.default_nsfw_cb.setChecked(self.config.default_nsfw)
        self.base_url_edit.setText(self.config.cosplay_base_url)
        self.admin_token_edit.setText(self.config.cosplay_admin_token)
        self.auto_publish_cb.setChecked(self.config.auto_publish)
        self.compress_enabled_cb.setChecked(self.config.compress_enabled)
        idx = self.compress_format_combo.findText(self.config.compress_format)
        if idx >= 0:
            self.compress_format_combo.setCurrentIndex(idx)
        self.compress_quality_spin.setValue(self.config.compress_quality)
        self.compress_maxw_spin.setValue(self.config.compress_max_width)
        self.concurrent_spin.setValue(self.config.concurrent_uploads)
        self.output_dir_edit.setText(self.config.output_dir)
        self.auto_clean_cb.setChecked(self.config.auto_clean_non_image)
        self.exclude_exts_edit.setText(', '.join(self.config.clean_exclude_exts))
        self.exclude_names_edit.setText(', '.join(self.config.clean_exclude_names))
        # 解压密码
        self.archive_passwords_edit.setPlainText('\n'.join(self.config.archive_passwords))
        # Telegram Bot
        self.tg_enabled_cb.setChecked(self.config.tg_enabled)
        self.tg_api_id_edit.setText(self.config.tg_api_id)
        self.tg_api_hash_edit.setText(self.config.tg_api_hash)
        self.tg_token_edit.setText(self.config.tg_bot_token)
        self.tg_chats_edit.setText(', '.join(str(c) for c in self.config.tg_allowed_chat_ids))
        tg_rating_idx = self.tg_rating_combo.findData(self.config.tg_default_rating)
        if tg_rating_idx >= 0:
            self.tg_rating_combo.setCurrentIndex(tg_rating_idx)
        self.tg_price_spin.setValue(int(self.config.tg_default_price))
        self.tg_premium_cb.setChecked(bool(self.config.tg_default_premium))
        # 代理
        proxy_idx = self.tg_proxy_type_combo.findData(self.config.tg_proxy_type)
        if proxy_idx >= 0:
            self.tg_proxy_type_combo.setCurrentIndex(proxy_idx)
        self.tg_proxy_host_edit.setText(self.config.tg_proxy_host)
        self.tg_proxy_port_edit.setText(str(self.config.tg_proxy_port) if self.config.tg_proxy_port else '')
        self.tg_proxy_user_edit.setText(self.config.tg_proxy_username)
        self.tg_proxy_pass_edit.setText(self.config.tg_proxy_password)

    def _on_save(self):
        self.config.api_url = self.api_url_edit.text().strip()
        self.config.api_key = self.api_key_edit.text().strip()
        self.config.host_name = self.host_name_edit.text().strip() or 'Chevereto'
        self.config.default_nsfw = self.default_nsfw_cb.isChecked()
        self.config.cosplay_base_url = self.base_url_edit.text().strip().rstrip('/')
        self.config.cosplay_admin_token = self.admin_token_edit.text().strip()
        self.config.auto_publish = self.auto_publish_cb.isChecked()
        self.config.compress_enabled = self.compress_enabled_cb.isChecked()
        self.config.compress_format = self.compress_format_combo.currentText()
        self.config.compress_quality = self.compress_quality_spin.value()
        self.config.compress_max_width = self.compress_maxw_spin.value()
        self.config.concurrent_uploads = self.concurrent_spin.value()
        self.config.output_dir = self.output_dir_edit.text().strip() or str(Path.home() / 'Documents' / 'CoshubPackages')
        self.config.auto_clean_non_image = self.auto_clean_cb.isChecked()
        self.config.clean_exclude_exts = [
            s.strip() for s in self.exclude_exts_edit.text().split(',') if s.strip()
        ]
        self.config.clean_exclude_names = [
            s.strip() for s in self.exclude_names_edit.text().split(',') if s.strip()
        ]
        # 解压密码：按行分割，去掉空行
        self.config.archive_passwords = [
            line.strip() for line in self.archive_passwords_edit.toPlainText().splitlines()
            if line.strip()
        ]
        # Telegram Bot
        self.config.tg_enabled = self.tg_enabled_cb.isChecked()
        self.config.tg_api_id = self.tg_api_id_edit.text().strip()
        self.config.tg_api_hash = self.tg_api_hash_edit.text().strip()
        self.config.tg_bot_token = self.tg_token_edit.text().strip()
        self.config.tg_allowed_chat_ids = [
            int(s.strip()) for s in self.tg_chats_edit.text().split(',')
            if s.strip().lstrip('-').isdigit()
        ]
        self.config.tg_default_rating = self.tg_rating_combo.currentData()
        self.config.tg_default_price = self.tg_price_spin.value()
        self.config.tg_default_premium = self.tg_premium_cb.isChecked()
        # 代理
        self.config.tg_proxy_type = self.tg_proxy_type_combo.currentData()
        self.config.tg_proxy_host = self.tg_proxy_host_edit.text().strip()
        port_str = self.tg_proxy_port_edit.text().strip()
        self.config.tg_proxy_port = int(port_str) if port_str.isdigit() else 0
        self.config.tg_proxy_username = self.tg_proxy_user_edit.text().strip()
        self.config.tg_proxy_password = self.tg_proxy_pass_edit.text().strip()
        self.config.save()
        self.accept()
