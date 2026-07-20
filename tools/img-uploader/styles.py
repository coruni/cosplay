DARK_QSS = """
* {
    font-family: "Segoe UI", "Microsoft YaHei UI", "PingFang SC", sans-serif;
    color: #e5e7eb;
}

#MainWindow, #central {
    background-color: #1c1c28;
}

#bodySplitter::handle {
    background-color: rgba(255, 255, 255, 0.04);
}

#formScroll, #formWidget {
    background-color: #1c1c28;
}

/* Toolbar */
#toolbar {
    background-color: #262633;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

#toolbarTitle {
    color: #ff2d78;
    letter-spacing: 0.5px;
}

#stepLabel {
    color: #9ca3af;
    font-size: 12px;
    padding: 4px 10px;
    background-color: rgba(0, 212, 255, 0.08);
    border: 1px solid rgba(0, 212, 255, 0.2);
    border-radius: 12px;
}

#tbBtn, #primaryTbBtn {
    background-color: transparent;
    color: #e5e7eb;
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 0 14px;
    font-size: 13px;
}

#tbBtn:hover {
    background-color: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.08);
}

#tbBtn:disabled {
    color: #4b5563;
}

#primaryTbBtn {
    background-color: #ff2d78;
    color: white;
    border: 1px solid #ff2d78;
}

#primaryTbBtn:hover {
    background-color: #e02468;
}

#primaryTbBtn:disabled {
    background-color: #4b5563;
    border-color: #4b5563;
    color: #9ca3af;
}

/* Section boxes */
#sectionBox {
    background-color: #262633;
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 10px;
}

#sectionTitle {
    color: #00d4ff;
}

#logBox {
    background-color: #1c1c28;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
}

/* Drop frame */
#dropFrame {
    background-color: rgba(255, 45, 120, 0.04);
    border: 2px dashed rgba(255, 45, 120, 0.3);
    border-radius: 10px;
}

#dropFrame:hover {
    background-color: rgba(255, 45, 120, 0.08);
    border-color: rgba(255, 45, 120, 0.5);
}

#dropHint {
    color: #ff2d78;
    font-size: 14px;
    font-weight: 500;
}

#dropSubHint {
    color: #6b7280;
    font-size: 11px;
}

/* Form fields */
#fieldLabel {
    color: #9ca3af;
    font-size: 12px;
}

#langTag {
    color: #6b7280;
    font-size: 11px;
    font-weight: 600;
    background-color: rgba(255, 255, 255, 0.04);
    border-radius: 4px;
    padding: 4px 0;
    qproperty-alignment: AlignCenter;
}

#fieldHint {
    color: #6b7280;
    font-size: 11px;
}

QLineEdit, QSpinBox, QComboBox, QTextEdit, QPlainTextEdit {
    background-color: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 0 12px;
    font-size: 13px;
    color: #e5e7eb;
    selection-background-color: #ff2d78;
}

QLineEdit:focus, QSpinBox:focus, QComboBox:focus {
    border-color: rgba(255, 45, 120, 0.4);
}

QComboBox::drop-down {
    border: none;
    width: 24px;
}

QComboBox QAbstractItemView {
    background-color: #262633;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 4px;
    outline: none;
    selection-background-color: rgba(255, 45, 120, 0.15);
    selection-color: #ff2d78;
}

/* QCompleter popup + QListWidget (Coser 列表弹窗等) */
QListView {
    background-color: #262633;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 4px;
    outline: none;
    color: #e5e7eb;
    font-size: 13px;
}

QListView::item {
    color: #e5e7eb;
    background-color: transparent;
    padding: 6px 10px;
    border-radius: 4px;
}

QListView::item:hover {
    background-color: rgba(255, 255, 255, 0.06);
    color: #ffffff;
}

QListView::item:selected {
    background-color: rgba(255, 45, 120, 0.2);
    color: #ff2d78;
}

#coserList {
    background-color: #1c1c28;
    border: 1px solid rgba(255, 255, 255, 0.06);
}

QSpinBox::up-button, QSpinBox::down-button {
    width: 0;
    height: 0;
    border: none;
}

QCheckBox {
    color: #d1d5db;
    font-size: 13px;
    spacing: 8px;
}

QCheckBox::indicator {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background-color: rgba(255, 255, 255, 0.03);
}

QCheckBox::indicator:checked {
    background-color: #ff2d78;
    border-color: #ff2d78;
}

/* Log view */
#logView {
    background-color: #14141c;
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 8px;
    padding: 8px;
    color: #d1d5db;
}

#overallProgress {
    background-color: #1c1c28;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 9px;
    text-align: center;
    color: #9ca3af;
    font-size: 11px;
}

#overallProgress::chunk {
    background-color: #00d4ff;
    border-radius: 9px;
}

#progressLabel {
    color: #9ca3af;
    font-size: 12px;
}

/* Status bar */
#statusBar {
    background-color: #262633;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
}

#statsLabel, #hostLabel {
    color: #9ca3af;
    font-size: 12px;
}

#hostLabel {
    color: #6b7280;
}

/* Settings dialog */
#SettingsDialog {
    background-color: #1c1c28;
}

#SettingsContent, #SettingsScroll {
    background-color: #1c1c28;
}

#settingsSection {
    color: #ff2d78;
    padding-top: 8px;
}

#divider {
    background-color: rgba(255, 255, 255, 0.06);
    border: none;
    max-height: 1px;
    min-height: 1px;
}

/* Buttons */
QPushButton#ghostBtn {
    background-color: transparent;
    color: #9ca3af;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 0 14px;
    min-height: 32px;
    font-size: 12px;
}

QPushButton#ghostBtn:hover {
    background-color: rgba(255, 255, 255, 0.06);
    color: #e5e7eb;
}

QPushButton#primaryBtn {
    background-color: #ff2d78;
    color: white;
    border: 1px solid #ff2d78;
    border-radius: 8px;
    padding: 0 18px;
    min-height: 36px;
    font-size: 13px;
    font-weight: 600;
}

QPushButton#primaryBtn:hover {
    background-color: #e02468;
}

/* Scrollbars */
QScrollBar:vertical {
    width: 6px;
    background: transparent;
    margin: 0;
}

QScrollBar::handle:vertical {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    min-height: 30px;
}

QScrollBar::handle:vertical:hover {
    background: rgba(255, 255, 255, 0.2);
}

QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
    height: 0;
}

QScrollBar:horizontal {
    height: 6px;
    background: transparent;
}

QScrollBar::handle:horizontal {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    min-width: 30px;
}

QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal {
    width: 0;
}

/* Message boxes */
QMessageBox {
    background-color: #1c1c28;
}

QMessageBox QLabel {
    color: #e5e7eb;
}

QMessageBox QPushButton {
    background-color: rgba(255, 255, 255, 0.06);
    color: #e5e7eb;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 0 16px;
    min-height: 32px;
}

QMessageBox QPushButton:hover {
    background-color: rgba(255, 255, 255, 0.1);
}
"""
