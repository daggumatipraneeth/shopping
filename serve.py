# Local dev server: like `python3 -m http.server`, but tells the browser not to cache,
# so edits always show up. GitHub Pages doesn't use this file.
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

ThreadingHTTPServer(("127.0.0.1", 8000), NoCache).serve_forever()
