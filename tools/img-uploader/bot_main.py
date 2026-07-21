"""
独立 Telegram Bot daemon 入口（无 GUI）。

用法：
    python bot_main.py

加载 ~/.coshub_publisher/config.json 后启动 bot polling。
适合放服务器/常驻后台。
"""
from __future__ import annotations
import sys
import signal
import logging
import time

from config import AppConfig
from tg_bot import TgBot
from bot_handler import BotHandler


def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
    )


def main():
    setup_logging()
    log = logging.getLogger('bot_main')

    config = AppConfig().load()

    if not config.tg_api_id or not config.tg_api_hash:
        log.error('tg_api_id / tg_api_hash 未配置，请在设置面板里填或编辑 ~/.coshub_publisher/config.json')
        sys.exit(1)
    if not config.tg_bot_token:
        log.error('tg_bot_token 未配置')
        sys.exit(1)

    if not config.tg_allowed_chat_ids:
        log.warning('tg_allowed_chat_ids 未配置，bot 将接受所有 chat 的消息（不安全）')

    bot = TgBot(
        api_id=config.tg_api_id,
        api_hash=config.tg_api_hash,
        bot_token=config.tg_bot_token,
        session_name=config.tg_session_name or 'coshub_publisher',
        proxy=config.build_tg_proxy(),
    )
    handler = BotHandler(bot, config)
    bot.set_message_handler(handler.handle_update)

    # 启动 bot（内部会验证 token 并登录）
    try:
        bot.start()
        me = bot.get_me()
        log.info('Bot 验证成功: @%s (id=%s)', me.get('username'), me.get('id'))
    except Exception as e:
        log.error('Bot 启动失败: %s', e)
        sys.exit(1)

    log.info('Bot daemon 已启动，Ctrl+C 退出')

    # 优雅退出
    stop_event = False

    def on_sig(signum, frame):
        nonlocal stop_event
        log.info('收到信号 %s，正在停止 ...', signum)
        stop_event = True

    signal.signal(signal.SIGINT, on_sig)
    signal.signal(signal.SIGTERM, on_sig)

    while not stop_event and bot.is_running():
        time.sleep(0.5)

    bot.stop()
    log.info('Bot 已退出')


if __name__ == '__main__':
    main()
