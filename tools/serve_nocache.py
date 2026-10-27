#!/usr/bin/env python3
"""プレビュー用: キャッシュ無効の簡易HTTPサーバー（本番同様にテキストはgzip圧縮）。 使い方: python3 tools/serve_nocache.py <LPフォルダ> [port]"""
import http.server, os, sys, gzip, io
root = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
port = int(sys.argv[2]) if len(sys.argv) > 2 else 8765
GZ = ('.html', '.css', '.js', '.svg', '.json', '.txt')
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=root, **k)
    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isfile(path) and path.endswith(GZ) and 'gzip' in self.headers.get('Accept-Encoding', ''):
            data = gzip.compress(open(path, 'rb').read(), 6)
            self.send_response(200)
            self.send_header('Content-Type', self.guess_type(path))
            self.send_header('Content-Encoding', 'gzip')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            return io.BytesIO(data)
        return super().send_head()
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache'); self.send_header('Expires', '0')
        super().end_headers()
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer.allow_reuse_address = True
http.server.ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
