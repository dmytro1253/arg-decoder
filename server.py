"""Локальный сервер ARG Decoder (by Dmytro): интерфейс, проверка ссылок, встроенный подбор
ключа Виженера (CPU/CUDA) и диагностика для вкладки «Отладка».

Сам сервер — только стандартная библиотека Python 3.9+; numpy/torch нужны движку Виженера.
Слушает лишь 127.0.0.1. Запуск: python server.py [--port 8765] [--no-browser]
"""
import argparse
import functools
import http.client
import http.server
import json
import os
import re
import socket
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

import backend
import ocr_backend
import updater

WEB_DIR = Path(__file__).resolve().parent / "web"
YT_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
OEMBED = "https://www.youtube.com/oembed?"
TIMEOUT = 12
USER_AGENT = "Mozilla/5.0 (ARG-Decoder local tool)"
CACHE = {}
RESTART = {"requested": False}
CACHE_LOCK = threading.Lock()
MAX_BODY = 64 * 1024
OCR_MAX_BODY = 16 * 1024 * 1024   # изображение для локального OCR (Base64 PNG)
# Проверять существование можно только на известных сервисах — так сервер не станет
# прокси для произвольных адресов (в том числе локальной сети).
LINK_HOSTS = {
    "files.catbox.moe", "litter.catbox.moe", "pastebin.com", "i.imgur.com", "imgur.com",
    "drive.google.com", "docs.google.com", "rentry.co", "rentry.org", "bit.ly", "tinyurl.com",
    "is.gd", "clck.ru", "cutt.ly", "rb.gy", "aka.ms", "disk.yandex.ru", "yadi.sk", "gist.github.com",
    "hastebin.com", "justpaste.it", "paste.ee", "controlc.com", "pastes.dev",
    "catbox.moe", "forms.gle", "goo.gl", "t.co", "vk.cc", "disk.yandex.com", "disk.360.yandex.ru",
}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


LINK_OPENER = urllib.request.build_opener(NoRedirect)


def check_link(url):
    """Проверяет, существует ли страница. Редиректы не выполняются, а возвращаются как адрес."""
    refused = {"status": "error", "message": "Этот сайт нельзя проверить автоматически — открой ссылку сам"}
    try:
        parsed = urllib.parse.urlparse(url)
        port = parsed.port
    except ValueError:
        return refused
    host = (parsed.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    if parsed.scheme != "https" or host not in LINK_HOSTS or port not in (None, 443) or parsed.username or parsed.password:
        return refused
    key = "link:" + url
    with CACHE_LOCK:
        if key in CACHE:
            return CACHE[key]
    request = urllib.request.Request(url, method="GET", headers={"User-Agent": USER_AGENT, "Range": "bytes=0-1023"})
    try:
        with LINK_OPENER.open(request, timeout=TIMEOUT) as response:
            result = {"status": "found", "http": response.status, "type": response.headers.get("Content-Type", "")}
    except urllib.error.HTTPError as error:
        if 300 <= error.code < 400:
            result = {"status": "redirect", "http": error.code, "location": error.headers.get("Location", "")}
        elif error.code in (404, 410):
            result = {"status": "not_found", "http": error.code}
        elif error.code in (401, 403):
            # Доступ закрыт — это не «страницы нет»; не кэшируем.
            result = {"status": "denied", "http": error.code, "message": "Сайт закрыл доступ (HTTP %d): страница может существовать" % error.code}
        else:
            result = {"status": "error", "http": error.code, "message": "Сайт ответил HTTP %d" % error.code}
    except (OSError, ValueError, http.client.HTTPException) as error:
        result = {"status": "error", "message": "Нет связи: %s" % error}
    if result["status"] in ("found", "not_found", "redirect"):
        with CACHE_LOCK:
            CACHE[key] = result
    return result


def check_youtube(video_id):
    """Возвращает словарь со статусом: found / not_found / denied / error."""
    with CACHE_LOCK:
        if video_id in CACHE:
            return CACHE[video_id]
    query = urllib.parse.urlencode({"url": "https://www.youtube.com/watch?v=" + video_id, "format": "json"})
    request = urllib.request.Request(OEMBED + query, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            data = json.load(response)
        result = {
            "status": "found",
            "title": data.get("title"),
            "author": data.get("author_name"),
            "authorUrl": data.get("author_url"),
            "thumbnail": data.get("thumbnail_url"),
        }
    except urllib.error.HTTPError as error:
        if error.code in (400, 404):
            result = {"status": "not_found", "http": error.code}
        elif error.code in (401, 403):
            # 401/403 — доступ закрыт, а не «видео нет»: статус «denied», в кэш не попадает.
            result = {"status": "denied", "http": error.code, "message": "YouTube закрыл доступ (HTTP %d): видео может существовать" % error.code}
        else:
            result = {"status": "error", "http": error.code, "message": "YouTube ответил HTTP %d" % error.code}
    except (OSError, ValueError) as error:
        result = {"status": "error", "message": "Нет связи с YouTube: %s" % error}
    if result["status"] in ("found", "not_found"):
        with CACHE_LOCK:
            CACHE[video_id] = result
    return result


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def send_json(self, payload, code=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def host_ok(self):
        """Защита от подмены DNS: API отвечает, только если страницу открыли как 127.0.0.1 или localhost."""
        port = self.server.server_address[1]
        return self.headers.get("Host", "") in ("127.0.0.1:%d" % port, "localhost:%d" % port)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        if parsed.path.startswith("/api/") and not self.host_ok():
            return self.send_json({"error": "Неверный адрес сервера"}, 403)
        if parsed.path == "/api/ping":
            return self.send_json({"ok": True, "version": backend.APP_VERSION})
        if parsed.path == "/api/diagnostics":
            return self.guarded(backend.diagnostics)
        if parsed.path == "/api/update/status":
            return self.guarded(updater.status)
        if parsed.path == "/api/update/check":   # ответ из кэша на 6 часов; принудительная проверка — POST
            return self.guarded(updater.check)
        if parsed.path == "/api/ocr/status":
            return self.guarded(ocr_backend.status)
        if parsed.path == "/api/vigenere/status":
            return self.guarded(lambda: backend.job_status(query.get("id", [""])[0]))
        if parsed.path == "/api/youtube":
            video_id = urllib.parse.parse_qs(parsed.query).get("id", [""])[0]
            if not YT_ID.match(video_id):
                return self.send_json({"status": "error", "message": "Неверный YouTube ID"}, 400)
            return self.send_json(check_youtube(video_id))
        if parsed.path == "/api/link":
            url = urllib.parse.parse_qs(parsed.query).get("url", [""])[0]
            return self.send_json(check_link(url[:2000]))
        return super().do_GET()

    # POST принимаем только от своей страницы: нестандартный заголовок не отправить с чужого сайта
    # без предварительного запроса CORS, на который этот сервер не отвечает.
    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if self.headers.get("X-ARG-Decoder") != "1" or not self.host_ok():
            return self.send_json({"error": "Запрос не от интерфейса программы"}, 403)
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return self.send_json({"error": "Неверная длина запроса"}, 400)
        if not 0 <= length <= (OCR_MAX_BODY if parsed.path == "/api/ocr" else MAX_BODY):
            return self.send_json({"error": "Слишком большой запрос"}, 413)
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
        except ValueError:
            return self.send_json({"error": "Неверный JSON"}, 400)
        if not isinstance(body, dict):
            return self.send_json({"error": "Ожидался JSON-объект"}, 400)
        query = urllib.parse.parse_qs(parsed.query)
        if parsed.path == "/api/vigenere":
            return self.guarded(lambda: backend.start_job(body))
        if parsed.path == "/api/vigenere/stop":
            return self.guarded(lambda: backend.stop_job(query.get("id", [""])[0]))
        if parsed.path == "/api/ocr":
            return self.guarded(lambda: ocr_backend.recognize(body))
        if parsed.path == "/api/update/check":
            return self.guarded(lambda: updater.check(force=True))
        if parsed.path == "/api/update/verify":
            return self.guarded(updater.verify_install)
        if parsed.path == "/api/update/download":
            return self.guarded(start_update)
        if parsed.path == "/api/update/restart":
            return self.guarded(lambda: request_restart(self.server))
        return self.send_json({"error": "Нет такого адреса"}, 404)

    def guarded(self, fn):
        """Выполняет обработчик API; ошибка уходит в журнал «Отладки» и в ответ, сервер не падает."""
        try:
            result = fn()
        except (KeyError, ValueError) as exc:
            result, code = {"error": str(exc).strip("'")}, 400
        except Exception as exc:  # noqa: BLE001
            backend.log_error("API " + self.path.split("?")[0], exc)
            result, code = {"error": "%s: %s" % (type(exc).__name__, exc)}, 500
        else:
            code = 200
        try:
            return self.send_json(result, code)
        except ConnectionError:
            return None  # вкладку закрыли до ответа — это не ошибка программы

    def log_message(self, fmt, *args):
        if args and isinstance(args[0], str) and "/api/youtube" in args[0]:
            sys.stdout.write("  проверка: %s\n" % urllib.parse.unquote(str(args[0]).split("id=")[-1].split(" ")[0]))


def start_update():
    """Скачать и проверить обновление. Адреса берутся из своей проверки GitHub, а не из запроса страницы."""
    info = updater.check()
    if info.get("status") != "update" or not info.get("can_install"):
        raise ValueError(info.get("mode_reason") or info.get("error") or "нет обновления, которое можно установить")
    return updater.stage_async(info)


def request_restart(server):
    """Перезапуск для установки: сервер выходит с кодом RESTART_CODE, запускатор ставит обновление и запускает программу снова."""
    if not updater.pending():
        raise ValueError("обновление ещё не скачано и не проверено")
    if os.environ.get("ARGDEC_LAUNCHER") != "1":
        return {"ok": False, "manual": True, "message": "Программа запущена не через Start — закрой её окно и запусти снова: обновление установится при запуске"}
    RESTART["requested"] = True
    threading.Timer(0.3, server.shutdown).start()
    return {"ok": True, "version": updater.pending().get("version")}


def free_port(start):
    for port in range(start, start + 50):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    raise RuntimeError("Не нашёл свободный порт")


def main():
    parser = argparse.ArgumentParser(description="ARG Decoder")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    # Консоль Windows может не уметь в кириллицу — не падаем, а заменяем символы.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(line_buffering=True, errors="replace")
    if not (WEB_DIR / "index.html").exists():
        sys.exit("Не найдена папка web рядом с server.py")
    port = free_port(args.port)
    backend.start_background()
    handler = functools.partial(Handler, directory=str(WEB_DIR))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    url = "http://127.0.0.1:%d/" % port
    print("ARG Decoder %s (by Dmytro) запущен: %s" % (backend.APP_VERSION, url))
    print("Python %s, папка данных: %s" % (sys.version.split()[0], backend.DATA_DIR))
    print("Закрой это окно, чтобы выключить программу.")
    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    if RESTART["requested"]:
        print("Перезапуск для установки обновления / Restarting to install the update…")
        sys.exit(updater.RESTART_CODE)


if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()
    main()
