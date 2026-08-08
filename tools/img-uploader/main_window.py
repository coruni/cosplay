from __future__ import annotations
import difflib
from pathlib import Path
from datetime import datetime

from PyQt5.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QPushButton,
    QFileDialog, QLabel, QFrame, QProgressBar, QMessageBox,
    QLineEdit, QCheckBox, QPlainTextEdit, QSplitter, QComboBox,
    QSizePolicy, QScrollArea, QDialog, QCompleter,
    QListWidget, QListWidgetItem, QGridLayout,
)
from PyQt5.QtCore import Qt, QSize, QStringListModel, QThread, pyqtSignal, QUrl
from PyQt5.QtGui import QFont, QColor, QTextCursor, QDragEnterEvent, QDropEvent, QImage, QPixmap, QDesktopServices

from config import AppConfig
from gallery_publisher import (
    GalleryPayload, generate_slug, auto_slug, translate_text,
    fetch_categories, fetch_cosplayers, fetch_series, fetch_characters,
)
from publish_worker import PublishWorker
from settings_dialog import SettingsDialog
from coser_list_dialog import CoserListDialog
from series_dialog import SeriesListDialog, CharacterListDialog
from archive_utils import is_archive
from title_parser import parse_archive_title
import styles


class _PreviewWorker(QThread):
    """后台解压压缩包并列出图片，供右侧预览面板使用。"""
    finished = pyqtSignal(int, list, int, int, object)  # gen, image_paths, video_count, total, extract_dir
    error = pyqtSignal(int, str)

    def __init__(self, gen: int, archive_path: Path, config, gen_getter=None):
        super().__init__()
        self.gen = gen
        self.archive_path = archive_path
        self.config = config
        # 主窗口代次 getter：用于判断自己是否已被新拖包取代（lambda 持有主窗口引用）
        self._gen_getter = gen_getter or (lambda: gen)

    def run(self):
        try:
            import archive_utils
            from image_utils import is_image, is_video
            cfg = self.config
            preview_root = cfg.temp_path / '_preview'
            preview_root.mkdir(parents=True, exist_ok=True)
            # 若已有更新的拖包请求进入，则中止本次解压（不回传结果）
            stop_cb = lambda: self.gen != self._gen_getter()
            extract_dir = archive_utils.extract_archive(
                self.archive_path, preview_root, cfg.archive_passwords,
                stop_cb=stop_cb,
            )
            all_files = archive_utils.list_files(extract_dir)
            image_files = sorted(
                (p for p in all_files if is_image(p)),
                key=archive_utils.natural_sort_key,
            )
            video_files = [p for p in all_files if is_video(p)]
            self.finished.emit(
                self.gen, image_files, len(video_files), len(all_files), extract_dir
            )
        except archive_utils.ExtractCancelled:
            return  # 已被新的拖包请求取代，静默放弃
        except Exception as e:
            self.error.emit(self.gen, str(e))


class _PreviewThumb(QLabel):
    """可点击打开原图的预览缩略图。"""
    clicked = pyqtSignal(object)

    def __init__(self, path):
        super().__init__()
        self._path = path
        self.setCursor(Qt.PointingHandCursor)
        self.setAlignment(Qt.AlignCenter)

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.clicked.emit(self._path)
        super().mousePressEvent(event)


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
    slug_ready = pyqtSignal(str, str, int)  # slug, en_title, gen

    def __init__(self, title_zh: str, title_en: str, title_ja: str = '', fallback_base: str = '', parent=None, gen: int = 0):
        super().__init__(parent)
        self._zh = title_zh
        self._en = title_en
        self._ja = title_ja
        self._fallback = fallback_base
        self.gen = gen

    def run(self):
        try:
            slug, en_title = auto_slug(self._zh, self._en, self._ja, fallback_base=self._fallback)
            self.slug_ready.emit(slug, en_title, self.gen)
        except Exception:
            self.slug_ready.emit('', '', self.gen)


class _JaWorker(QThread):
    """后台翻译（zh/en → ja），完成后发信号回主线程填充日文标题。"""
    ja_ready = pyqtSignal(str, int)  # ja_title, gen

    def __init__(self, source_lang: str, source_text: str, parent=None, gen: int = 0):
        super().__init__(parent)
        self._lang = source_lang
        self._text = source_text
        self.gen = gen

    def run(self):
        try:
            ja = translate_text(self._text, self._lang, 'ja')
            self.ja_ready.emit(ja or '', self.gen)
        except Exception:
            self.ja_ready.emit('', self.gen)


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
            self._on_drop(archives)
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
        self.series: list[dict] = []            # [{series, galleryCount, characters}]
        self.characters: list[dict] = []         # [{name, galleryCount}]
        self._series_names: list[str] = []
        self._char_names: list[str] = []
        self._series_char_map: dict[str, list[str]] = {}  # series -> [character]
        self._slug_worker: _SlugWorker | None = None
        self._ja_worker: _JaWorker | None = None
        self._bot = None  # TgBot
        self._bot_handler = None  # BotHandler
        self._archive_queue: list[Path] = []  # 待顺序处理的压缩包队列
        self._auto_gen = 0  # 代次令牌：每载入新压缩包自增，旧 worker 回调 gen 不匹配则忽略
        self._preview_gen = 0  # 预览线程代次令牌
        self._preview_thread: _PreviewWorker | None = None
        self._preview_extract_dir: Path | None = None  # 预览已解压目录，发布时复用避免重复解压
        self._preview_archive_path: Path | None = None  # 该解压目录对应的压缩包
        self._batch_mode = False  # 批量模式：用户点一次「一键发布」后自动连续发布剩余队列
        self._batch_publish_when_slug_ready = False  # 批量模式下 slug 翻译完即自动发布
        self._batch_publish_when_ja_ready = False  # 批量模式下 ja 翻译完即自动发布

        self.setWindowTitle('CosHub Publisher')
        self.resize(1180, 780)
        self.setAttribute(Qt.WA_StyledBackground, True)
        self.setObjectName('MainWindow')

        self._build_ui()
        self._apply_styles()
        self._refresh_status()
        self._load_categories()
        self._load_cosplayers()
        self._load_series_characters()

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

        # 水平分隔：左列 = 原 body（表单 + 日志），右列 = 图片预览
        hsplit = QSplitter(Qt.Horizontal)
        hsplit.setObjectName('mainHSplitter')
        hsplit.setHandleWidth(1)
        hsplit.setChildrenCollapsible(False)
        hsplit.addWidget(body)
        hsplit.addWidget(self._build_preview_panel())
        hsplit.setSizes([760, 420])
        main_layout.addWidget(hsplit, 1)

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
        self.drop_frame.set_drop_handler(self._on_archives_dropped)

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
        self.next_btn = QPushButton('下一个 ▶')
        self.next_btn.setObjectName('ghostBtn')
        self.next_btn.setMinimumHeight(32)
        self.next_btn.setCursor(Qt.PointingHandCursor)
        self.next_btn.setEnabled(False)
        self.next_btn.clicked.connect(lambda: self._process_queue_head(skip_current=True))
        btn_row.addWidget(self.next_btn)
        btn_row.addStretch()
        self.queue_label = QLabel('队列：空')
        self.queue_label.setObjectName('dropSubHint')
        btn_row.addWidget(self.queue_label)
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

        self._char_completer = QCompleter()
        self._char_completer.setCaseSensitivity(Qt.CaseInsensitive)
        self._char_completer.setFilterMode(Qt.MatchContains)
        self._char_completer.setModel(QStringListModel([], self))
        self.character_edit.setCompleter(self._char_completer)

        self.char_list_btn = QPushButton('列表')
        self.char_list_btn.setObjectName('ghostBtn')
        self.char_list_btn.setMinimumHeight(32)
        self.char_list_btn.setCursor(Qt.PointingHandCursor)
        self.char_list_btn.clicked.connect(self._on_open_char_list)
        meta_row1.addWidget(self.char_list_btn)

        meta_row1.addWidget(self._mini_label('Series'))
        self.series_edit = QLineEdit()
        self.series_edit.setMinimumHeight(32)
        meta_row1.addWidget(self.series_edit)

        self._series_completer = QCompleter()
        self._series_completer.setCaseSensitivity(Qt.CaseInsensitive)
        self._series_completer.setFilterMode(Qt.MatchContains)
        self._series_completer.setModel(QStringListModel([], self))
        self.series_edit.setCompleter(self._series_completer)
        # 系列变化后，按绑定关系过滤角色候选
        self.series_edit.editingFinished.connect(self._refresh_character_completer)

        self.series_list_btn = QPushButton('列表')
        self.series_list_btn.setObjectName('ghostBtn')
        self.series_list_btn.setMinimumHeight(32)
        self.series_list_btn.setCursor(Qt.PointingHandCursor)
        self.series_list_btn.clicked.connect(self._on_open_series_list)
        meta_row1.addWidget(self.series_list_btn)

        lay.addLayout(meta_row1)

        # 分类（多选 + 标签）
        cat_row = QHBoxLayout()
        cat_row.setSpacing(8)
        cat_row.addWidget(self._mini_label('分类'), 0)
        self.category_list = QListWidget()
        self.category_list.setMinimumHeight(96)
        self.category_list.setSelectionMode(QListWidget.NoSelection)
        self.category_list.setVerticalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        self.category_list.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        cat_row.addWidget(self.category_list, 1)
        cat_col = QVBoxLayout()
        cat_col.setSpacing(6)
        cat_col.addWidget(self._mini_label('标签'))
        self.tags_edit = QLineEdit()
        self.tags_edit.setPlaceholderText('逗号分隔')
        self.tags_edit.setMinimumHeight(32)
        cat_col.addWidget(self.tags_edit)
        cat_row.addLayout(cat_col, 1)
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

    # ─────────────────── 右侧图片预览面板 ───────────────────

    def _build_preview_panel(self) -> QWidget:
        panel = QWidget()
        panel.setObjectName('previewPanel')
        lay = QVBoxLayout(panel)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)

        header = QFrame()
        header.setObjectName('previewHeader')
        header.setFixedHeight(40)
        hlay = QHBoxLayout(header)
        hlay.setContentsMargins(12, 0, 12, 0)
        title = QLabel('图片预览')
        title.setObjectName('sectionTitle')
        title.setFont(QFont('Segoe UI', 11, QFont.Bold))
        hlay.addWidget(title)
        hlay.addStretch()
        self.preview_count_lbl = QLabel('')
        self.preview_count_lbl.setObjectName('dropSubHint')
        hlay.addWidget(self.preview_count_lbl)
        lay.addWidget(header)

        self.preview_scroll = QScrollArea()
        self.preview_scroll.setWidgetResizable(True)
        self.preview_scroll.setFrameShape(QFrame.NoFrame)
        self.preview_scroll.setObjectName('previewScroll')

        self.preview_viewport = QWidget()
        self.preview_viewport.setObjectName('previewViewport')
        self.preview_grid = QGridLayout(self.preview_viewport)
        self.preview_grid.setContentsMargins(10, 10, 10, 10)
        self.preview_grid.setSpacing(8)
        self.preview_scroll.setWidget(self.preview_viewport)

        self.preview_placeholder = QLabel('拖入压缩包后在此预览图片')
        self.preview_placeholder.setObjectName('dropSubHint')
        self.preview_placeholder.setAlignment(Qt.AlignCenter)
        self.preview_grid.addWidget(self.preview_placeholder, 0, 0)

        lay.addWidget(self.preview_scroll, 1)
        return panel

    def _clear_preview_grid(self):
        """移除网格里所有缩略图（保留占位 label 对象，仅从布局摘离）。"""
        while self.preview_grid.count():
            item = self.preview_grid.takeAt(0)
            w = item.widget()
            if w is not None and w is not self.preview_placeholder:
                w.setParent(None)
                w.deleteLater()

    def _set_preview_placeholder(self, text: str):
        self.preview_placeholder.setText(text)
        if self.preview_grid.indexOf(self.preview_placeholder) == -1:
            self.preview_grid.addWidget(self.preview_placeholder, 0, 0)

    def _load_preview(self, path: Path):
        """拖入压缩包后，在后台解压并加载右侧预览。"""
        # 取消上一个仍在跑的预览线程（不强制强杀，靠 gen 令牌忽略旧结果）
        if self._preview_thread is not None and self._preview_thread.isRunning():
            self._preview_thread.quit()
        self._preview_gen += 1
        self._clear_preview_grid()
        self._set_preview_placeholder('正在解压预览…')
        self.preview_count_lbl.setText('')
        thread = _PreviewWorker(self._preview_gen, path, self.config, gen_getter=lambda: self._preview_gen)
        thread.finished.connect(self._on_preview_loaded)
        thread.error.connect(self._on_preview_error)
        thread.finished.connect(thread.deleteLater)
        thread.error.connect(thread.deleteLater)
        self._preview_thread = thread
        thread.start()

    def _on_preview_loaded(self, gen: int, image_paths: list, video_count: int, total: int, extract_dir):
        if gen != self._preview_gen:
            return
        # 记住本次预览解压出来的目录，发布时直接复用，避免重复解压
        self._preview_extract_dir = extract_dir
        self._clear_preview_grid()
        if not image_paths:
            self._set_preview_placeholder('（压缩包内无图片）')
            self.preview_count_lbl.setText(f'{total} 文件 / {video_count} 视频')
            return
        cols = 2
        thumb_w, thumb_h = 200, 266  # 3:4 缩略图
        for i, p in enumerate(image_paths):
            thumb = _PreviewThumb(p)
            thumb.setObjectName('previewThumbCover' if i == 0 else 'previewThumb')
            thumb.setFixedSize(thumb_w, thumb_h)
            img = QImage(str(p))
            if img.isNull():
                thumb.setText(p.name)
            else:
                pix = QPixmap.fromImage(
                    img.scaled(thumb_w, thumb_h, Qt.KeepAspectRatio, Qt.SmoothTransformation)
                )
                thumb.setPixmap(pix)
            thumb.setToolTip(f'{i + 1}. {p.name}' + ('  (封面)' if i == 0 else ''))
            thumb.clicked.connect(lambda _p=p: QDesktopServices.openUrl(QUrl.fromLocalFile(str(_p))))
            self.preview_grid.addWidget(thumb, i // cols, i % cols)
        self.preview_count_lbl.setText(f'{len(image_paths)} 张图片 / {video_count} 视频')

    def _on_preview_error(self, gen: int, msg: str):
        if gen != self._preview_gen:
            return
        self._clear_preview_grid()
        self._set_preview_placeholder(f'预览失败: {msg}')
        self.preview_count_lbl.setText('')

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
            and bool(self.title_zh_edit.text().strip())
            and not (self.worker and self.worker.isRunning())
        )

    def _load_categories(self):
        if not self.config.cosplay_base_url or not self.config.cosplay_admin_token:
            return
        try:
            cats = fetch_categories(self.config)
            self.categories = cats
            self.category_list.clear()
            for c in cats:
                name = c.get('nameZh') or c.get('nameEn') or c.get('nameJa') or c.get('slug', '')
                slug = c.get('slug', '')
                item = QListWidgetItem(f"{c.get('icon','')} {name}")
                item.setData(Qt.UserRole, slug)
                item.setFlags(item.flags() | Qt.ItemIsUserCheckable)
                item.setCheckState(Qt.Unchecked)
                self.category_list.addItem(item)
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

    def _match_coser(self, name: str) -> str | None:
        """
        在 cosplayer 列表中查找与给定名字最相似的 coser，返回其规范名（name）。
        相似度低于阈值（避免误填不相关的 coser）或列表为空时返回 None。
        """
        name = (name or '').strip()
        if not name or not self.cosplayers:
            return None
        best: str | None = None
        best_ratio = 0.0
        for c in self.cosplayers:
            variants = [
                v for v in (
                    c.get('name'), c.get('nameZh'),
                    c.get('nameEn'), c.get('nameJa'), c.get('slug'),
                ) if isinstance(v, str) and v.strip()
            ]
            for v in variants:
                ratio = difflib.SequenceMatcher(None, name, v).ratio()
                if ratio > best_ratio:
                    best_ratio = ratio
                    best = c.get('name') or v
        # 阈值 0.6：中英混排名字差异较大时也不会误填
        return best if best_ratio >= 0.6 else None

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

    def _load_series_characters(self):
        """从后台聚合拉取系列与角色（含绑定关系），填充自动补全模型。"""
        if not self.config.cosplay_base_url or not self.config.cosplay_admin_token:
            return
        if not hasattr(self, '_series_completer'):
            return
        try:
            series = fetch_series(self.config)
            characters = fetch_characters(self.config)
            self.series = series
            self.characters = characters
            self._series_names = [s.get('series', '') for s in series if s.get('series')]
            self._char_names = [c.get('name', '') for c in characters if c.get('name')]
            self._series_char_map = {
                s.get('series', ''): list(s.get('characters', []) or [])
                for s in series
                if s.get('series')
            }
            self._series_completer.setModel(QStringListModel(self._series_names, self))
            self._refresh_character_completer()
        except Exception as e:
            self._log('warn', f'加载系列/角色失败: {e}')

    def _refresh_character_completer(self):
        """按当前所选系列过滤角色候选（角色与系列绑定）。"""
        if not hasattr(self, '_char_completer'):
            return
        series = (self.series_edit.text() or '').strip()
        if series and series in self._series_char_map:
            names = list(self._series_char_map[series])
        else:
            names = list(self._char_names)
        self._char_completer.setModel(QStringListModel(names, self))

    def _series_of_character(self, character: str) -> str | None:
        """查找包含该角色最多的系列（用于拖包自动预填系列）。"""
        character = (character or '').strip()
        if not character or not self._series_char_map:
            return None
        best: str | None = None
        best_count = 0
        for s, chars in self._series_char_map.items():
            if character in chars:
                cnt = chars.count(character)
                if cnt > best_count:
                    best_count = cnt
                    best = s
        return best

    def _on_open_series_list(self):
        if not self.series:
            QMessageBox.information(self, '提示', '暂无系列数据，请检查后台地址 / Admin Token 是否已配置')
            return
        dlg = SeriesListDialog(self.series, self)
        if dlg.exec_() == QDialog.Accepted:
            name = dlg.selected_name()
            if name:
                self.series_edit.setText(name)
                self.series_edit.setFocus()
                self._refresh_character_completer()

    def _on_open_char_list(self):
        series = (self.series_edit.text() or '').strip()
        if series and series in self._series_char_map:
            char_items = [{'name': c, 'galleryCount': 0} for c in self._series_char_map[series]]
        else:
            char_items = self.characters
        if not char_items:
            QMessageBox.information(self, '提示', '暂无角色数据，请检查后台地址 / Admin Token 是否已配置')
            return
        dlg = CharacterListDialog(char_items, self)
        if dlg.exec_() == QDialog.Accepted:
            name = dlg.selected_name()
            if name:
                self.character_edit.setText(name)
                self.character_edit.setFocus()

    def _on_archive_dropped(self, path: Path):
        self._auto_gen += 1  # 新包：作废之前可能还在跑的翻译 worker 回调
        self.archive_path = path
        self._preview_archive_path = path
        self._preview_extract_dir = None  # 旧预览目录作废，等本次预览完成后再更新

        # 自动解析 coser / 系列 / 角色名
        parsed = parse_archive_title(path.stem, known_series=self._series_names)

        # 自动填字段（仅在为空时填，避免覆盖用户已输入的内容）
        if not self.title_zh_edit.text().strip():
            self.title_zh_edit.setText(parsed.clean_title or path.stem)
        # cosplayer：先在列表中模糊匹配最相似的规范名，匹配不到则回退解析名
        if not self.cosplayer_edit.text().strip() and parsed.cosplayer:
            matched = self._match_coser(parsed.cosplayer)
            self.cosplayer_edit.setText(matched or parsed.cosplayer)
        # 系列：优先用文件名里直接解析出的 series（如 "无职转生"/"RE0"）
        if not self.series_edit.text().strip() and parsed.series:
            self.series_edit.setText(parsed.series)
            self._refresh_character_completer()
        if not self.character_edit.text().strip() and parsed.character:
            self.character_edit.setText(parsed.character)
            # 仍未填系列则尝试由角色反查（兜底）
            if not self.series_edit.text().strip():
                s = self._series_of_character(parsed.character)
                if s:
                    self.series_edit.setText(s)
                    self._refresh_character_completer()
        if not self.slug_edit.text().strip():
            # 异步：中文标题 → 翻译成英文 → slugify（与后台 autoSlug 一致）
            self._request_auto_slug()
        # 异步：中文/英文标题 → 翻译成日文，自动填充日文标题
        self._request_auto_ja()

        # 右侧图片预览（后台解压当前压缩包）
        self._load_preview(path)

        self._refresh_status()

    def _on_select_archive(self):
        fs, _ = QFileDialog.getOpenFileNames(
            self, '选择压缩包', '',
            '压缩包 (*.zip *.rar *.7z);;所有文件 (*.*)',
        )
        if fs:
            for f in fs:
                self._archive_queue.append(Path(f))
            self._log('info', f'已加入队列 {len(fs)} 个（待处理共 {len(self._archive_queue)}）')
            self._update_queue_label()
            self._process_queue_head()

    def _on_archives_dropped(self, paths: list[Path]):
        """拖入多个压缩包：全部入队，再按顺序驱动处理。"""
        added = 0
        for p in paths:
            self._archive_queue.append(p)
            added += 1
        if added:
            self._log('info', f'已加入队列 {added} 个（待处理共 {len(self._archive_queue)}）')
            self._update_queue_label()
            self._process_queue_head()

    def _process_queue_head(self, skip_current: bool = False):
        """按队列顺序把队首压缩包载入表单，等待用户点击「一键发布」。"""
        # 正在发布中：等 _on_done 完成后会再次驱动，这里不抢
        if self.worker is not None and self.worker.isRunning():
            return
        if skip_current:
            self._reset_form()
        # 当前表单已载入一个待发布的压缩包（且非跳过）：保持不动，等发布完再处理
        if self.archive_path is not None and not skip_current:
            self._update_queue_label()
            return
        if not self._archive_queue:
            self._update_queue_label()
            return
        path = self._archive_queue.pop(0)
        self._on_archive_dropped(path)
        self._update_queue_label()

    # 发布默认由用户点击「一键发布」触发；批量模式下用户点一次后自动连续发布。

    def _continue_batch(self):
        """批量模式：等 slug / 日文标题翻译就绪后自动发布当前包。"""
        self._batch_publish_when_slug_ready = True
        if not self.slug_edit.text().strip():
            self._request_auto_slug()
        else:
            self._batch_publish_when_slug_ready = False
            self._maybe_batch_publish()
        if not self.title_ja_edit.text().strip():
            self._batch_publish_when_ja_ready = True
            self._request_auto_ja()

    def _maybe_batch_publish(self):
        """slug 与 ja 翻译均就绪后，自动发布当前包（批量模式）。"""
        if self._batch_publish_when_slug_ready or self._batch_publish_when_ja_ready:
            return  # 仍有翻译在跑，等回调
        self._on_publish()

    def _advance_or_finish_batch(self):
        """批量模式：载入下一个并继续；队列空则结束批量。"""
        if self._archive_queue:
            self._process_queue_head()
            self._continue_batch()
        else:
            self._batch_mode = False
            QMessageBox.information(self, '完成', '✅ 批量发布已全部完成')

    def _update_queue_label(self):
        n = len(self._archive_queue)
        if n:
            self.queue_label.setText(f'待处理队列：{n}')
            self.next_btn.setEnabled(True)
        else:
            self.queue_label.setText('队列：空')
            self.next_btn.setEnabled(False)

    def _reset_form(self):
        """清空表单所有字段，准备接收下一个压缩包。"""
        for edit in (self.slug_edit, self.title_zh_edit, self.title_en_edit,
                     self.title_ja_edit, self.cosplayer_edit, self.character_edit,
                     self.series_edit, self.tags_edit, self.download_url_edit):
            edit.clear()
        for ed in (self.desc_zh_edit, self.desc_en_edit, self.desc_ja_edit):
            ed.clear()
        self.price_edit.setText('0')
        for i in range(self.category_list.count()):
            item = self.category_list.item(i)
            if item is not None:
                item.setCheckState(Qt.Unchecked)
        self.rating_combo.setCurrentIndex(0)
        self.premium_cb.setChecked(False)
        self.archive_path = None
        self._preview_archive_path = None
        self._preview_extract_dir = None  # 预览解压目录随表单重置而作废
        # 注意：不在此清除 _batch_mode，批量开关由发布流程显式管理
        self._batch_publish_when_slug_ready = False
        self._batch_publish_when_ja_ready = False
        if self.worker is not None and not self.worker.isRunning():
            self.worker = None
        self.progress_bar.setValue(0)
        self.progress_label.setText('就绪')
        # 清空右侧图片预览
        self._clear_preview_grid()
        self._set_preview_placeholder('拖入压缩包后在此预览图片')
        self.preview_count_lbl.setText('')
        self.step_label.setText('待开始')
        self.status_lbl.setText('就绪')
        self._refresh_status()

    def _request_auto_slug(self, gen: int | None = None):
        """启动后台 _SlugWorker 生成 slug。会跳过正在跑的旧 worker。"""
        if gen is None:
            gen = self._auto_gen
        if self._slug_worker and self._slug_worker.isRunning():
            return  # 已有任务在跑，避免重复请求
        zh = self.title_zh_edit.text().strip()
        en = self.title_en_edit.text().strip()
        ja = self.title_ja_edit.text().strip()
        if not zh and not en and not ja:
            return
        # 翻译失败时的兜底 slug 来源：原始压缩包文件名（通常含罗马音/英文）
        fallback_base = self.archive_path.stem if self.archive_path else ''
        self._log('info', '正在生成 Slug（必要时调用翻译）...')
        self._slug_worker = _SlugWorker(zh, en, ja, fallback_base, self, gen)
        self._slug_worker.slug_ready.connect(self._on_slug_ready)
        self._slug_worker.start()

    def _on_slug_ready(self, slug: str, en_title: str, gen: int = 0):
        if gen != self._auto_gen:
            return  # 结果已过时（已切到下一个包），忽略旧 worker 回调
        if not slug:
            self._log('warn', 'Slug 生成失败（翻译未返回有效结果）')
            if self._batch_publish_when_slug_ready:
                self._batch_publish_when_slug_ready = False
                self._batch_publish_when_ja_ready = False
                if self._batch_mode:
                    self._log('error', '跳过当前压缩包：Slug 生成失败')
                    self._reset_form()
                    self._update_queue_label()
                    self._advance_or_finish_batch()
            return
        self.slug_edit.setText(slug)
        # 翻译得到的英文标题同步填入英译框（仅当为空时，避免覆盖用户输入）
        if en_title and not self.title_en_edit.text().strip():
            self.title_en_edit.setText(en_title)
        self._log('success', f'Slug 已生成: {slug}')
        self._refresh_status()
        if self._batch_publish_when_slug_ready:
            self._batch_publish_when_slug_ready = False
            self._maybe_batch_publish()

    def _on_gen_slug(self):
        """按钮触发：强制重新生成 slug。"""
        if self._slug_worker and self._slug_worker.isRunning():
            return
        self._request_auto_slug()
        # 顺带补一份日文标题（若为空）
        self._request_auto_ja()

    def _request_auto_ja(self, gen: int | None = None):
        """拖入压缩包后，若中文/英文标题存在且日文标题为空，后台翻译出日文标题。"""
        if gen is None:
            gen = self._auto_gen
        if self._ja_worker and self._ja_worker.isRunning():
            return  # 已有任务在跑，避免重复请求
        if self.title_ja_edit.text().strip():
            return  # 已有日文标题，不覆盖用户手填内容
        zh = self.title_zh_edit.text().strip()
        en = self.title_en_edit.text().strip()
        if zh:
            src_lang, src_text = 'zh', zh
        elif en:
            src_lang, src_text = 'en', en
        else:
            return
        self._log('info', '正在生成日文标题（翻译）...')
        self._ja_worker = _JaWorker(src_lang, src_text, self, gen)
        self._ja_worker.ja_ready.connect(self._on_ja_ready)
        self._ja_worker.start()

    def _on_ja_ready(self, ja: str, gen: int = 0):
        if gen != self._auto_gen:
            return  # 结果已过时（已切到下一个包），忽略旧 worker 回调
        if ja and not self.title_ja_edit.text().strip():
            self.title_ja_edit.setText(ja)
            self._log('success', f'日文标题已生成: {ja}')
        self._refresh_status()
        if self._batch_publish_when_ja_ready:
            self._batch_publish_when_ja_ready = False
            self._maybe_batch_publish()

    def _on_publish(self):
        # 首次手动点击且仍有后续队列 → 进入批量模式（之后自动连续发布，无需再点）
        if not self._batch_mode and self._archive_queue:
            self._batch_mode = True
        if not self.config.api_url or not self.config.api_key:
            QMessageBox.warning(self, '提示', '请先在设置中配置 Chevereto API')
            return
        if not self.config.cosplay_base_url or not self.config.cosplay_admin_token:
            QMessageBox.warning(self, '提示', '请先在设置中配置 cosplay 后台地址和 Admin Token')
            return
        if not self.archive_path:
            QMessageBox.warning(self, '提示', '请先选择压缩包')
            return
        if not self.slug_edit.text().strip():
            if (self.title_zh_edit.text().strip() or self.title_en_edit.text().strip()) \
                    and not (self._slug_worker and self._slug_worker.isRunning()):
                self._request_auto_slug()
                QMessageBox.warning(self, '提示', '正在自动生成 Slug，请稍候片刻再点「一键发布」')
            else:
                QMessageBox.warning(self, '提示', '请填写 Slug')
            return
        if not self.title_zh_edit.text().strip():
            QMessageBox.warning(self, '提示', '请填写中文标题')
            return

        try:
            price = float(self.price_edit.text() or '0')
        except ValueError:
            price = 0.0

        cat_slugs: list[str] = []
        for i in range(self.category_list.count()):
            item = self.category_list.item(i)
            if item is not None and item.checkState() == Qt.Checked:
                slug = item.data(Qt.UserRole)
                if slug:
                    cat_slugs.append(slug)
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
            categories=cat_slugs,
            tags=tags,
            rating=self.rating_combo.currentData(),
            price=price,
            isPremium=self.premium_cb.isChecked(),
            downloadUrl=download_url,
        )

        self._log('info', '=' * 50)
        self._log('info', f'开始发布：{payload.slug} - {payload.titleZh}')

        # 复用预览已解压目录：必须属于当前压缩包且仍有效
        reuse_dir = None
        if (
            self._preview_archive_path == self.archive_path
            and self._preview_extract_dir is not None
            and self._preview_extract_dir.exists()
            and any(self._preview_extract_dir.iterdir())
        ):
            reuse_dir = self._preview_extract_dir

        self.worker = PublishWorker(self.archive_path, payload, self.config, extracted_dir=reuse_dir)
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
        if self._archive_queue:
            self._log('warn', f'已清空待处理队列（{len(self._archive_queue)} 个）')
        self._archive_queue.clear()
        self._batch_mode = False
        self._batch_publish_when_slug_ready = False
        self._batch_publish_when_ja_ready = False
        self._update_queue_label()
        self.stop_btn.setEnabled(False)

    def _on_settings(self):
        dlg = SettingsDialog(self.config, self)
        if dlg.exec_() == QDialog.Accepted:
            self.host_lbl.setText(self.config.host_name or 'Chevereto')
            self._load_categories()
            self._load_cosplayers()
            self._load_series_characters()
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
            self._log('success', f'发布成功: {result}；队列剩余 {len(self._archive_queue)}')
            self._reset_form()
            self._update_queue_label()
            if self._batch_mode:
                # 批量模式：静默继续下一个，不弹窗
                self._advance_or_finish_batch()
            else:
                QMessageBox.information(self, '成功', f'图包已发布！\n\n{result}')
        else:
            self.progress_label.setText('失败')
            self.status_lbl.setText(f'失败: {error[:80]}')
            self._log('error', f'发布失败: {error[:80]}')
            if self._batch_mode:
                # 批量模式：跳过失败项继续下一个
                self._log('error', '发布失败，跳过此包继续')
                self._reset_form()
                self._update_queue_label()
                self._advance_or_finish_batch()
            else:
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
