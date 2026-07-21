"""
Telethon (MTProto) 实现的 Telegram Bot 客户端。

为什么用 Telethon 而不是 Bot API：
- Bot API 免费版单文件下载限制 20MB
- MTProto 协议直连 Telegram 服务器，文件限制 2GB
- bot 账号也能用 Telethon 登录（bot_token 模式）

架构：
- 在独立线程里跑 asyncio loop
- 主线程（PyQt5 GUI）通过线程安全的同步方法调用 bot
- 事件回调是 async，在 loop 线程里执行
"""
from __future__ import annotations
from pathlib import Path
import asyncio
import logging
import threading
from typing import Optional, Callable, Awaitable

log = logging.getLogger(__name__)


class TgBotError(RuntimeError):
    pass


class TgBot:
    """Telethon 包装：独立线程跑 asyncio loop。"""

    def __init__(
        self,
        api_id: str,
        api_hash: str,
        bot_token: str = '',
        session_name: str = 'coshub_publisher',
        session_dir: Optional[Path] = None,
        proxy: Optional[tuple] = None,
    ):
        """
        proxy: telethon 接受的 proxy 元组，如 ('socks5', '127.0.0.1', 7890)
               或带认证 ('socks5', 'host', port, True, username, password)
               None 表示不使用代理。
        """
        self.api_id = api_id
        self.api_hash = api_hash
        self.bot_token = bot_token.strip()
        self.session_name = session_name
        self.proxy = proxy
        # session 文件放在配置目录下，避免污染 cwd
        self.session_dir = session_dir or (Path.home() / '.coshub_publisher' / 'sessions')
        self.session_dir.mkdir(parents=True, exist_ok=True)

        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._client = None  # telethon.TelegramClient
        self._thread: Optional[threading.Thread] = None
        self._running = False
        self._on_message: Optional[Callable[[object], Awaitable[None]]] = None
        self._me: Optional[dict] = None
        self._start_error: Optional[Exception] = None
        self._ready = threading.Event()

    # ───────── 主线程 API：同步包装 ─────────

    def set_message_handler(self, callback):
        """callback 应是 async function(event) -> None。"""
        self._on_message = callback

    def start(self) -> None:
        """启动 bot（主线程调用，非阻塞）。失败抛 TgBotError。"""
        if self._running:
            return
        self._running = True
        self._start_error = None
        self._ready.clear()

        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

        # 等待 client 启动完成或失败
        if not self._ready.wait(timeout=30):
            self._running = False
            raise TgBotError('Bot 启动超时')
        if self._start_error:
            self._running = False
            raise TgBotError(f'Bot 启动失败: {self._start_error}')

    def stop(self) -> None:
        """停止 bot（主线程调用，阻塞直到 loop 退出）。"""
        if not self._running:
            return
        self._running = False
        if self._loop and self._client:
            try:
                fut = asyncio.run_coroutine_threadsafe(
                    self._client.disconnect(), self._loop
                )
                fut.result(timeout=5)
            except Exception as e:
                log.warning('停止 bot 异常: %s', e)
        if self._thread:
            self._thread.join(timeout=5)
            self._thread = None
        self._loop = None
        self._client = None
        self._me = None

    def is_running(self) -> bool:
        return self._running and self._client is not None

    @property
    def client(self):
        """暴露 telethon client，供 async 代码直接使用（避免死锁）。"""
        return self._client

    @property
    def loop(self):
        return self._loop

    def get_me(self) -> dict:
        """同步获取 bot 自身信息。"""
        if self._me:
            return self._me
        if not self._loop or not self._client:
            raise TgBotError('Bot 未启动')
        fut = asyncio.run_coroutine_threadsafe(self._client.get_me(), self._loop)
        me = fut.result(timeout=10)
        self._me = {
            'id': me.id,
            'username': me.username or '',
            'first_name': getattr(me, 'first_name', '') or '',
        }
        return self._me

    def send_message(self, chat_id: int, text: str, parse_mode: str = 'HTML') -> None:
        """同步发送消息（线程安全）。"""
        if not self._loop or not self._client:
            raise TgBotError('Bot 未启动')
        if len(text) > 4000:
            text = text[:4000] + '...'
        fut = asyncio.run_coroutine_threadsafe(
            self._client.send_message(chat_id, text, parse_mode=parse_mode, link_preview=False),
            self._loop,
        )
        fut.result(timeout=15)

    def download_media(self, message, dest: Path) -> Path:
        """同步下载媒体文件到 dest（线程安全）。"""
        if not self._loop or not self._client:
            raise TgBotError('Bot 未启动')
        dest.parent.mkdir(parents=True, exist_ok=True)
        fut = asyncio.run_coroutine_threadsafe(
            self._client.download_media(message, file=str(dest)),
            self._loop,
        )
        result = fut.result(timeout=600)  # 大文件给 10 分钟
        return Path(result) if result else dest

    # ───────── loop 线程 ─────────

    def _run_loop(self):
        asyncio.set_event_loop(self._loop)
        try:
            self._loop.run_until_complete(self._main())
        except Exception as e:
            log.exception('Telethon loop 异常: %s', e)
            self._start_error = e
            self._ready.set()
        finally:
            self._running = False

    async def _main(self):
        from telethon import TelegramClient, events

        session_path = self.session_dir / self.session_name
        client_kwargs = {
            'loop': self._loop,
        }
        if self.proxy:
            client_kwargs['proxy'] = self.proxy
        self._client = TelegramClient(
            str(session_path),
            int(self.api_id),
            self.api_hash,
            **client_kwargs,
        )

        try:
            if self.bot_token:
                await self._client.start(bot_token=self.bot_token)
            else:
                # 用户身份登录（首次需要交互输入手机号/验证码）
                # daemon 线程里没法交互，所以推荐用 bot_token 模式
                await self._client.start()
        except Exception as e:
            self._start_error = e
            self._ready.set()
            return

        me = await self._client.get_me()
        self._me = {
            'id': me.id,
            'username': me.username or '',
            'first_name': getattr(me, 'first_name', '') or '',
        }
        log.info('Telethon 已登录: @%s (id=%s)', self._me['username'], self._me['id'])

        @self._client.on(events.NewMessage(incoming=True))
        async def _on_new_message(event):
            if self._on_message:
                try:
                    await self._on_message(event)
                except Exception as e:
                    log.exception('消息处理异常: %s', e)

        self._ready.set()
        log.info('Telethon polling started')
        await self._client.run_until_disconnected()
        log.info('Telethon polling stopped')
