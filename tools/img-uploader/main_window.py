from __future__ import annotations
from pathlib import Path
from datetime import datetime

from PyQt5.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QPushButton,
    QFileDialog, QLabel, QFrame, QProgressBar, QMessageBox,
    QLineEdit, QCheckBox, QPlainTextEdit, QSplitter, QComboBox,
    QSizePolicy, QScrollArea, QDialog, QCompleter,
)
from PyQt5.QtCore import Qt, QSize, QStringListModel, QThread, pyqtSignal
from PyQt5.QtGui import QFont, QColor, QTextCursor, QDragEnterEvent, QDropEvent

from config import AppConfig
from gallery_publisher import (
    GalleryPayload, generate_slug, auto_slug, fetch_categories, fetch_cosplayers,
)
from publish_worker import PublishWorker
from settings_dialog import SettingsDialog
from coser_list_dialog import CoserListDialog
from archive_utils import is_archive
from title_parser import parse_archive_title
import styles


STEP_LABELS = {
    'idle': '待开始',
    'extract': '① 解压',
    'clean': '② 清理',
    'normalize': '③ 规范化',
    'repackage': '④ 重新打包',
    'upload': '⑤ 压缩 + 上传图床',
    'publish': '⑥ 发布到后台',
    'done': '完成',
}

LOG_COLORS = {
    'info': '#9ca3af',
    'warn': '#f59e0b',
    'error': '#ef4444',
    'success': '#22c55e',
}


class _SlugWorker(QThread):
    """后台调用 auto_slug（含网络翻译），完成后发信号回主线程。"""
    slug_ready = pyqtSignal(str, str)  # slug, en_title

    def __init__(self, title_zh: str, title_en: str, title_ja: str = '', parent=None):
        super().__init__(parent)
        self._zh = title_zh
        self._en = title_en
        self._ja = title_ja

    def run(self):
        try:
            slug, en_title = auto_slug(self._zh, self._en, self._ja)
            self.slug_ready.emit(slug, en_title)
        except Exception:
            self.slug_ready.emit('', '')


class DropFrame(QFrame):
    """可拖入压缩包的区域。"""
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setAcceptDrops(True)
        self.setObjectName('dropFrame')
        self.setFixedHeight(80)
        self.setMinimumWidth(400)
        self._on_drop = None

    def set_drop_handler(self, handler):
        self._on_drop = handler

    def dragEnterEvent(self, e: QDragEnterEvent):
        if e.mimeData().hasUrls():
            e.acceptProposedAction()
        else:
            e.ignore()

    def dragMoveEvent(self, e):
        if e.mimeData().hasUrls():
            e.acceptProposedAction()
        else:
            e.ignore()

    def dropEvent(self, e: QDropEvent):
        urls = e.mimeData().urls()
        paths = [Path(u.toLocalFile()) for u in urls if u.toLocalFile()]
        archives = [p for p in paths if p.is_file() and is_archive(p)]
        if archives and self._on_drop:
            self._on_drop(archives[0])
        e.acceptProposedAction()


class MainWindow(QMainWindow):
    def __init__(self, config: AppConfig):
        super().__init__()
        self.config = config
        self.archive_path: Path | None = None
        self.worker: PublishWorker | None = None
        self.categories: list[dict] = []
        self.cosplayers: list[dict] = []
        self._coser_names: list[str] = []
        self._slug_worker: _SlugWorker | None = None
        self._bot = None  # TgBot
        self._bot_handler = None  # BotHandler

        self.setWindowTitle('CosHub Publisher')
        self.resize(960, 760)
        self.setAttribute(Qt.WA_StyledBackground, True)
        self.setObjectName('MainWindow')

        self._build_ui()
        self._apply_styles()
        self._refresh_status()
        self._load_categories()
        self._load_cosplayers()

        # 根据配置自动启动 bot
        if self.config.tg_enabled and self.config.tg_bot_token:
            self._start_bot()

    # ─────────────────── UI 构建 ───────────────────

    def _build_ui(self):
        central = QWidget()
        central.setObjectName('central')
        self.setCentralWidget(central)

        main_layout = QVBoxLayout(central)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        main_layout.addWidget(self._build_toolbar())

        body = QSplitter(Qt.Vertical)
        body.setObjectName('bodySplitter')
        body.setHandleWidth(1)
        body.setChildrenCollapsible(False)

        # 上半部分：表单（可滚动）
        form_scroll = QScrollArea()
        form_scroll.setWidgetResizable(True)
        form_scroll.setFrameShape(QFrame.NoFrame)
        form_scroll.setObjectName('formScroll')
        form_scroll.setMinimumHeight(360)

        form_widget = QWidget()
        form_widget.setObjectName('formWidget')
        form_layout = QVBoxLayout(form_widget)
        form_layout.setContentsMargins(20, 16, 20, 16)
        form_layout.setSpacing(14)

        form_layout.addWidget(self._build_archive_section())
        form_layout.addWidget(self._build_info_section())
        form_layout.addWidget(self._build_publish_section())
        form_layout.addStretch()

        form_scroll.setWidget(form_widget)
        body.addWidget(form_scroll)

        # 下半部分：日志 + 进度
        body.addWidget(self._build_log_section())

        body.setSizes([440, 320])
        main_layout.addWidget(body, 1)

        main_layout.addWidget(self._build_status_bar())

    def _build_toolbar(self) -> QFrame:
        toolbar = QFrame()
        toolbar.setObjectName('toolbar')
        toolbar.setFixedHeight(52)
        lay = QHBoxLayout(toolbar)
        lay.setContentsMargins(12, 8, 12, 8)
        lay.setSpacing(6)

        title_lbl = QLabel('CosHub Publisher')
        title_lbl.setObjectName('toolbarTitle')
        title_lbl.setFont(QFont('Segoe UI', 12, QFont.Bold))
        lay.addWidget(title_lbl)

        lay.addSpacing(16)

        self.step_label = QLabel('待开始')
        self.step_label.setObjectName('stepLabel')
        lay.addWidget(self.step_label)

        lay.addStretch()

        self.publish_btn = self._tb_btn('一键发布', primary=True)
        self.publish_btn.clicked.connect(self._on_publish)
        lay.addWidget(self.publish_btn)

        self.stop_btn = self._tb_btn('停止')
        self.stop_btn.clicked.connect(self._on_stop)
        self.stop_btn.setEnabled(False)
        lay.addWidget(self.stop_btn)

        self.bot_btn = self._tb_btn('Bot: 关')
        self.bot_btn.setObjectName('ghostBtn')
        self.bot_btn.clicked.connect(self._on_toggle_bot)
        lay.addWidget(self.bot_btn)

        self.settings_btn = self._tb_btn('设置')
        self.settings_btn.clicked.connect(self._on_settings)
        lay.addWidget(self.settings_btn)

        return toolbar

    def _build_archive_section(self) -> QFrame:
        box = QFrame()
        box.setObjectName('sectionBox')
        lay = QVBoxLayout(box)
        lay.setContentsMargins(16, 14, 16, 14)
        lay.setSpacing(10)

        title = QLabel('① 压缩包')
        title.setObjectName('sectionTitle')
        title.setFont(QFont('Segoe UI', 11, QFont.Bold))
        lay.addWidget(title)

        self.drop_frame = DropFrame()
        self.drop_frame.set_drop_handler(self._on_archive_dropped)

        drop_lay = QVBoxLayout(self.drop_frame)
        drop_lay.setContentsMargins(16, 8, 16, 8)
        drop_lay.setSpacing(4)

        self.drop_hint = QLabel('把 .zip / .rar / .7z 拖到这里')
        self.drop_hint.setObjectName('dropHint')
        self.drop_hint.setAlignment(Qt.AlignCenter)
        drop_lay.addWidget(self.drop_hint)

        self.archive_path_lbl = QLabel('或点击下方按钮选择')
        self.archive_path_lbl.setObjectName('dropSubHint')
        self.archive_path_lbl.setAlignment(Qt.AlignCenter)
        drop_lay.addWidget(self.archive_path_lbl)

        lay.addWidget(self.drop_frame)

        btn_row = QHBoxLayout()
        btn_row.setSpacing(8)
        self.select_btn = QPushButton('选择压缩包')
        self.select_btn.setObjectName('ghostBtn')
        self.select_btn.setMinimumHeight(32)
        self.select_btn.setCursor(Qt.PointingHandCursor)
        self.select_btn.clicked.connect(self._on_select_archive)
        btn_row.addWidget(self.select_btn)
        btn_row.addStretch()
        lay.addLayout(btn_row)

        return box

    def _build_info_section(self) -> QFrame:
        box = QFrame()
        box.setObjectName('sectionBox')
        lay = QVBoxLayout(box)
        lay.setContentsMargins(16, 14, 16, 14)
        lay.setSpacing(10)

        title = QLabel('② 图包信息')
        title.setObjectName('sectionTitle')
        title.setFont(QFont('Segoe UI', 11, QFont.Bold))
        lay.addWidget(title)

        # Slug
        slug_row = QHBoxLayout()
        slug_row.setSpacing(8)
        slug_row.addWidget(self._mini_label('Slug'))
        self.slug_edit = QLineEdit()
        self.slug_edit.setPlaceholderText('url 标识，如 2b-yorha')
        self.slug_edit.setMinimumHeight(32)
        slug_row.addWidget(self.slug_edit, 2)

        gen_slug_btn = QPushButton('从标题生成')
        gen_slug_btn.setObjectName('ghostBtn')
        gen_slug_btn.setMinimumHeight(32)
        gen_slug_btn.setCursor(Qt.PointingHandCursor)
        gen_slug_btn.clicked.connect(self._on_gen_slug)
        slug_row.addWidget(gen_slug_btn)
        lay.addLayout(slug_row)

        # 标题（中/英/日）
        lay.addWidget(self._mini_label('标题'))
        for lang, attr in [('中', 'zh'), ('英', 'en'), ('日', 'ja')]:
            row = QHBoxLayout()
            row.setSpacing(8)
            tag = QLabel(lang)
            tag.setObjectName('langTag')
            tag.setFixedWidth(20)
            row.addWidget(tag)
            edit = QLineEdit()
            edit.setMinimumHeight(32)
            row.addWidget(edit)
            setattr(self, f'title_{attr}_edit', edit)
            lay.addLayout(row)

        # 描述（中/英/日）— 折叠为单行简化
        lay.addWidget(self._mini_label('描述（可选）'))
        for lang, attr in [('中', 'zh'), ('英', 'en'), ('日', 'ja')]:
            row = QHBoxLayout()
            row.setSpacing(8)
            tag = QLabel(lang)
            tag.setObjectName('langTag')
            tag.setFixedWidth(20)
            row.addWidget(tag)
            edit = QLineEdit()
            edit.setMinimumHeight(32)
            row.addWidget(edit)
            setattr(self, f'desc_{attr}_edit', edit)
            lay.addLayout(row)

        # 关联信息
        meta_row1 = QHBoxLayout()
        meta_row1.setSpacing(8)
        meta_row1.addWidget(self._mini_label('Cosplayer'))
        self.cosplayer_edit = QLineEdit()
        self.cosplayer_edit.setMinimumHeight(32)
        meta_row1.addWidget(self.cosplayer_edit)

        # Coser 自动补全 + 列表按钮
        self._coser_completer = QCompleter()
        self._coser_completer.setCaseSensitivity(Qt.CaseInsensitive)
        self._coser_completer.setFilterMode(Qt.MatchContains)
        self._coser_completer.setModel(QStringListModel([], self))
        self.cosplayer_edit.setCompleter(self._coser_completer)

        self.coser_list_btn = QPushButton('列表')
        self.coser_list_btn.setObjectName('ghostBtn')
        self.coser_list_btn.setMinimumHeight(32)
        self.coser_list_btn.setCursor(Qt.PointingHandCursor)
        self.coser_list_btn.clicked.connect(self._on_open_coser_list)
        meta_row1.addWidget(self.coser_list_btn)

        meta_row1.addWidget(self._mini_label('Character'))
        self.character_edit = QLineEdit()
        self.character_edit.setMinimumHeight(32)
        meta_row1.addWidget(self.character_edit)
        meta_row1.addWidget(self._mini_label('Series'))
        self.series_edit = QLineEdit()
        self.series_edit.setMinimumHeight(32)
        meta_row1.addWidget(self.series_edit)
        lay.addLayout(meta_row1)

        # 分类（多选 + 标签）
        cat_row = QHBoxLayout()
        cat_row.setSpacing(8)
        cat_row.addWidget(self._mini_label('分类'))
        self.category_combo = QComboBox()
        self.category_combo.setMinimumHeight(32)
        self.category_combo.addItem('（不选）', '')
        cat_row.addWidget(self.category_combo, 1)
        cat_row.addWidget(self._mini_label('标签'))
        self.tags_edit = QLineEdit()
        self.tags_edit.setPlaceholderText('逗号分隔')
        self.tags_edit.setMinimumHeight(32)
        cat_row.addWidget(self.tags_edit, 1)
        lay.addLayout(cat_row)

        return box

    def _build_publish_section(self) -> QFrame:
        box = QFrame()
        box.setObjectName('sectionBox')
        lay = QVBoxLayout(box)
        lay.setContentsMargins(16, 14, 16, 14)
        lay.setSpacing(10)

        title = QLabel('③ 发布选项')
        title.setObjectName('sectionTitle')
        title.setFont(QFont('Segoe UI', 11, QFont.Bold))
        lay.addWidget(title)

        row = QHBoxLayout()
        row.setSpacing(12)

        row.addWidget(self._mini_label('分级'))
        self.rating_combo = QComboBox()
        self.rating_combo.addItem('SFW', 'sfw')
        self.rating_combo.addItem('NSFW', 'nsfw')
        self.rating_combo.setMinimumHeight(32)
        row.addWidget(self.rating_combo)

        row.addWidget(self._mini_label('价格 ¥'))
        self.price_edit = QLineEdit('0')
        self.price_edit.setMinimumHeight(32)
        self.price_edit.setFixedWidth(80)
        row.addWidget(self.price_edit)

        self.premium_cb = QCheckBox('会员专享')
        row.addWidget(self.premium_cb)

        row.addStretch()
        lay.addLayout(row)

        dl_row = QHBoxLayout()
        dl_row.setSpacing(8)
        dl_row.addWidget(self._mini_label('外链下载'))
        self.download_url_edit = QLineEdit()
        self.download_url_edit.setPlaceholderText('网盘地址（可选，留空则只上传图片不提供下载包）')
        self.download_url_edit.setMinimumHeight(32)
        dl_row.addWidget(self.download_url_edit, 1)
        lay.addLayout(dl_row)

        hint = QLabel('提示：留空外链时，后台会显示 zip 包路径作为下载地址')
        hint.setObjectName('fieldHint')
        lay.addWidget(hint)

        return box

    def _build_log_section(self) -> QFrame:
        box = QFrame()
        box.setObjectName('logBox')
        lay = QVBoxLayout(box)
        lay.setContentsMargins(16, 12, 16, 12)
        lay.setSpacing(8)

        header = QHBoxLayout()
        header.setSpacing(8)
        title = QLabel('处理日志')
        title.setObjectName('sectionTitle')
        title.setFont(QFont('Segoe UI', 11, QFont.Bold))
        header.addWidget(title)
        header.addStretch()

        self.clear_log_btn = QPushButton('清空')
        self.clear_log_btn.setObjectName('ghostBtn')
        self.clear_log_btn.setMinimumHeight(26)
        self.clear_log_btn.setCursor(Qt.PointingHandCursor)
        self.clear_log_btn.clicked.connect(self._on_clear_log)
        header.addWidget(self.clear_log_btn)
        lay.addLayout(header)

        self.log_view = QPlainTextEdit()
        self.log_view.setReadOnly(True)
        self.log_view.setObjectName('logView')
        self.log_view.setMinimumHeight(160)
        self.log_view.setFont(QFont('Consolas', 10))
        lay.addWidget(self.log_view, 1)

        prog_row = QHBoxLayout()
        prog_row.setSpacing(8)
        self.progress_bar = QProgressBar()
        self.progress_bar.setObjectName('overallProgress')
        self.progress_bar.setFixedHeight(18)
        self.progress_bar.setTextVisible(True)
        self.progress_bar.setFormat('%p%')
        prog_row.addWidget(self.progress_bar, 1)
        self.progress_label = QLabel('就绪')
        self.progress_label.setObjectName('progressLabel')
        self.progress_label.setFixedWidth(180)
        prog_row.addWidget(self.progress_label)
        lay.addLayout(prog_row)

        return box

    def _build_status_bar(self) -> QFrame:
        bar = QFrame()
        bar.setObjectName('statusBar')
        bar.setFixedHeight(32)
        lay = QHBoxLayout(bar)
        lay.setContentsMargins(16, 0, 16, 0)
        lay.setSpacing(16)

        self.status_lbl = QLabel('就绪')
        self.status_lbl.setObjectName('statsLabel')
        lay.addWidget(self.status_lbl)
        lay.addStretch()

        self.host_lbl = QLabel(self.config.host_name or 'Chevereto')
        self.host_lbl.setObjectName('hostLabel')
        lay.addWidget(self.host_lbl)
        return bar

    def _tb_btn(self, text: str, primary: bool = False) -> QPushButton:
        btn = QPushButton(text)
        btn.setObjectName('primaryTbBtn' if primary else 'tbBtn')
        btn.setMinimumHeight(36)
        btn.setCursor(Qt.PointingHandCursor)
        return btn

    def _mini_label(self, text: str) -> QLabel:
        lbl = QLabel(text)
        lbl.setObjectName('fieldLabel')
        return lbl

    def _apply_styles(self):
        self.setStyleSheet(styles.DARK_QSS)

    # ─────────────────── 业务 ───────────────────

    def _refresh_status(self):
        if self.archive_path:
            self.drop_hint.setText(f'已选: {self.archive_path.name}')
            self.archive_path_lbl.setText(str(self.archive_path.parent))
        else:
            self.drop_hint.setText('把 .zip / .rar / .7z 拖到这里')
            self.archive_path_lbl.setText('或点击下方按钮选择')

        self.publish_btn.setEnabled(
            bool(self.archive_path)
            and bool(self.slug_edit.text().strip())
            and bool(self.title_zh_edit.text().strip())
            and not (self.worker and self.worker.isRunning())
        )

    def _load_categories(self):
        if not self.config.cosplay_base_url or not self.config.cosplay_admin_token:
            return
        try:
            cats = fetch_categories(self.config)
            self.categories = cats
            self.category_combo.clear()
            self.category_combo.addItem('（不选）', '')
            for c in cats:
                name = c.get('nameZh') or c.get('nameEn') or c.get('nameJa') or c.get('slug', '')
                self.category_combo.addItem(f"{c.get('icon','')} {name}", c.get('slug', ''))
        except Exception as e:
            self._log('warn', f'加载分类失败: {e}')

    def _load_cosplayers(self):
        """从后台聚合拉取 coser 列表，填充自动补全模型。"""
        if not self.config.cosplay_base_url or not self.config.cosplay_admin_token:
            return
        if not hasattr(self, '_coser_completer'):
            return
        try:
            cosers = fetch_cosplayers(self.config)
            self.cosplayers = cosers
            self._coser_names = [c.get('name', '') for c in cosers if c.get('name')]
            self._coser_completer.setModel(QStringListModel(self._coser_names, self))
        except Exception as e:
            self._log('warn', f'加载 coser 列表失败: {e}')

    def _on_open_coser_list(self):
        if not self.cosplayers:
            QMessageBox.information(self, '提示', '暂无 coser 数据，请检查后台地址 / Admin Token 是否已配置')
            return
        dlg = CoserListDialog(self.cosplayers, self)
        if dlg.exec_() == QDialog.Accepted:
            name = dlg.selected_name()
            if name:
                self.cosplayer_edit.setText(name)
                self.cosplayer_edit.setFocus()

    def _on_archive_dropped(self, path: Path):
        self.archive_path = path

        # 自动解析 coser / 角色名
        parsed = parse_archive_title(path.stem)

        # 自动填字段（仅在为空时填，避免覆盖用户已输入的内容）
        if not self.title_zh_edit.text().strip():
            self.title_zh_edit.setText(parsed.clean_title or path.stem)
        if not self.cosplayer_edit.text().strip() and parsed.cosplayer:
            self.cosplayer_edit.setText(parsed.cosplayer)
        if not self.character_edit.text().strip() and parsed.character:
            self.character_edit.setText(parsed.character)
        if not self.slug_edit.text().strip():
            # 异步：中文标题 → 翻译成英文 → slugify（与后台 autoSlug 一致）
            self._request_auto_slug()

        self._refresh_status()

    def _on_select_archive(self):
        f, _ = QFileDialog.getOpenFileName(
            self, '选择压缩包', '',
            '压缩包 (*.zip *.rar *.7z);;所有文件 (*.*)',
        )
        if f:
            self._on_archive_dropped(Path(f))

    def _request_auto_slug(self):
        """启动后台 _SlugWorker 生成 slug。会跳过正在跑的旧 worker。"""
        if self._slug_worker and self._slug_worker.isRunning():
            return  # 已有任务在跑，避免重复请求
        zh = self.title_zh_edit.text().strip()
        en = self.title_en_edit.text().strip()
        ja = self.title_ja_edit.text().strip()
        if not zh and not en and not ja:
            return
        self._log('info', '正在生成 Slug（必要时调用翻译）...')
        self._slug_worker = _SlugWorker(zh, en, ja, self)
        self._slug_worker.slug_ready.connect(self._on_slug_ready)
        self._slug_worker.start()

    def _on_slug_ready(self, slug: str, en_title: str):
        if not slug:
            self._log('warn', 'Slug 生成失败（翻译未返回有效结果），请手动填写')
            return
        self.slug_edit.setText(slug)
        # 翻译得到的英文标题同步填入英译框（仅当为空时，避免覆盖用户输入）
        if en_title and not self.title_en_edit.text().strip():
            self.title_en_edit.setText(en_title)
        self._log('success', f'Slug 已生成: {slug}')
        self._refresh_status()

    def _on_gen_slug(self):
        """按钮触发：强制重新生成 slug。"""
        if self._slug_worker and self._slug_worker.isRunning():
            return
        self._request_auto_slug()

    def _on_publish(self):
        if not self.archive_path:
            QMessageBox.warning(self, '提示', '请先选择压缩包')
            return
        if not self.slug_edit.text().strip():
            QMessageBox.warning(self, '提示', '请填写 Slug')
            return
        if not self.title_zh_edit.text().strip():
            QMessageBox.warning(self, '提示', '请填写中文标题')
            return
        if not self.config.api_url or not self.config.api_key:
            QMessageBox.warning(self, '提示', '请先在设置中配置 Chevereto API')
            return
        if not self.config.cosplay_base_url or not self.config.cosplay_admin_token:
            QMessageBox.warning(self, '提示', '请先在设置中配置 cosplay 后台地址和 Admin Token')
            return

        try:
            price = float(self.price_edit.text() or '0')
        except ValueError:
            price = 0.0

        cat_slug = self.category_combo.currentData() or ''
        tags = [t.strip() for t in self.tags_edit.text().split(',') if t.strip()]
        download_url = self.download_url_edit.text().strip() or None

        payload = GalleryPayload(
            slug=self.slug_edit.text().strip(),
            titleZh=self.title_zh_edit.text().strip(),
            titleEn=self.title_en_edit.text().strip(),
            titleJa=self.title_ja_edit.text().strip(),
            descriptionZh=self.desc_zh_edit.text().strip(),
            descriptionEn=self.desc_en_edit.text().strip(),
            descriptionJa=self.desc_ja_edit.text().strip(),
            cosplayer=self.cosplayer_edit.text().strip(),
            character=self.character_edit.text().strip(),
            series=self.series_edit.text().strip(),
            categories=[cat_slug] if cat_slug else [],
            tags=tags,
            rating=self.rating_combo.currentData(),
            price=price,
            isPremium=self.premium_cb.isChecked(),
            downloadUrl=download_url,
        )

        self._log('info', '=' * 50)
        self._log('info', f'开始发布：{payload.slug} - {payload.titleZh}')

        self.worker = PublishWorker(self.archive_path, payload, self.config)
        self.worker.log.connect(self._on_log)
        self.worker.step.connect(self._on_step)
        self.worker.progress.connect(self._on_progress)
        self.worker.done.connect(self._on_done)
        self.worker.start()

        self.publish_btn.setEnabled(False)
        self.stop_btn.setEnabled(True)
        self.progress_bar.setValue(0)

    def _on_stop(self):
        if self.worker and self.worker.isRunning():
            self.worker.stop()
            self._log('warn', '正在停止...')
        self.stop_btn.setEnabled(False)

    def _on_settings(self):
        dlg = SettingsDialog(self.config, self)
        if dlg.exec_() == QDialog.Accepted:
            self.host_lbl.setText(self.config.host_name or 'Chevereto')
            self._load_categories()
            self._load_cosplayers()
            # bot 配置变更后同步状态
            self._sync_bot_state_after_settings()

    def _sync_bot_state_after_settings(self):
        """设置面板保存后，根据新配置调整 bot 状态。"""
        # 如果 bot 在跑且 token 变了，重启
        # 如果 bot 在跑但 tg_enabled 关了，停止
        # 如果 bot 没跑但 tg_enabled 开了且有 token，启动
        bot_running = self._bot is not None and self._bot.is_running()
        token = self.config.tg_bot_token.strip()
        if bot_running and not token:
            self._stop_bot()
            return
        if bot_running and not self.config.tg_enabled:
            self._stop_bot()
            return
        if bot_running and token and self.config.tg_enabled:
            # token 变了的话重启
            if self._bot and self._bot.token != token:
                self._stop_bot()
                self._start_bot()
            return
        if not bot_running and token and self.config.tg_enabled:
            self._start_bot()

    def _on_toggle_bot(self):
        if self._bot is not None and self._bot.is_running():
            self._stop_bot()
        else:
            if not self.config.tg_bot_token.strip():
                QMessageBox.warning(self, 'Bot', '请先在设置里填写 Bot Token')
                return
            self._start_bot()

    def _start_bot(self):
        if self._bot is not None and self._bot.is_running():
            return
        cfg = self.config
        if not cfg.tg_api_id or not cfg.tg_api_hash:
            QMessageBox.warning(self, 'Bot', '请先在设置里填写 Telegram API ID / API Hash')
            return
        if not cfg.tg_bot_token:
            QMessageBox.warning(self, 'Bot', '请先在设置里填写 Bot Token')
            return
        try:
            from tg_bot import TgBot
            from bot_handler import BotHandler
            bot = TgBot(
                api_id=cfg.tg_api_id,
                api_hash=cfg.tg_api_hash,
                bot_token=cfg.tg_bot_token,
                session_name=cfg.tg_session_name or 'coshub_publisher',
                proxy=cfg.build_tg_proxy(),
            )
            bot.start()  # 内部会验证 token
            me = bot.get_me()
            handler = BotHandler(bot, cfg)
            bot.set_message_handler(handler.handle_update)
            self._bot = bot
            self._bot_handler = handler
            self.bot_btn.setText(f'Bot: @{me.get("username", "?")}')
            self._log('success', f'Bot 已启动: @{me.get("username")}')
        except Exception as e:
            self._log('error', f'Bot 启动失败: {e}')
            QMessageBox.warning(self, 'Bot', f'启动失败:\n{e}')

    def _stop_bot(self):
        if self._bot is None:
            return
        try:
            self._bot.stop()
            self._log('info', 'Bot 已停止')
        except Exception as e:
            self._log('warn', f'Bot 停止异常: {e}')
        finally:
            self._bot = None
            self._bot_handler = None
            self.bot_btn.setText('Bot: 关')

    def closeEvent(self, e):
        """窗口关闭时停止 bot。"""
        if self._bot is not None:
            self._stop_bot()
        super().closeEvent(e)

    def _on_clear_log(self):
        self.log_view.clear()

    def _on_log(self, level: str, msg: str):
        self._log(level, msg)

    def _on_step(self, step: str):
        self.step_label.setText(STEP_LABELS.get(step, step))

    def _on_progress(self, current: int, total: int, msg: str):
        pct = int(current * 100 / total) if total else 0
        self.progress_bar.setValue(pct)
        self.progress_label.setText(msg)

    def _on_done(self, success: bool, result: str, error: str):
        self.publish_btn.setEnabled(True)
        self.stop_btn.setEnabled(False)
        if success:
            self.progress_bar.setValue(100)
            self.progress_label.setText('完成')
            self.step_label.setText('完成')
            self.status_lbl.setText(f'发布成功: {result}')
            QMessageBox.information(self, '成功', f'图包已发布！\n\n{result}')
        else:
            self.progress_label.setText('失败')
            self.status_lbl.setText(f'失败: {error[:80]}')
            QMessageBox.critical(self, '失败', error or '未知错误')
        self._refresh_status()

    def _log(self, level: str, msg: str):
        color = LOG_COLORS.get(level, '#9ca3af')
        ts = datetime.now().strftime('%H:%M:%S')
        self.log_view.appendHtml(
            f'<span style="color:#6b7280">[{ts}]</span> '
            f'<span style="color:{color}">{msg}</span>'
        )
        self.log_view.moveCursor(QTextCursor.End)
