# -*- coding: utf-8 -*-
"""把 index.html + css + js + 背景图打包成单个可直接双击打开的 HTML。
用法：python tools/build-single.py
输出：海滩打字小勇士-单文件版.html
"""
import base64
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
HTML = ROOT / "index.html"
CSS = ROOT / "css" / "style.css"
JS = ROOT / "js" / "game.js"
BG = ROOT / "assets" / "bg-beach.png"
OUT = ROOT / "海滩打字小勇士-单文件版.html"

html = HTML.read_text(encoding="utf-8")
css = CSS.read_text(encoding="utf-8")
js = JS.read_text(encoding="utf-8")
bg_b64 = base64.b64encode(BG.read_bytes()).decode("ascii")

html = html.replace(
    '<link rel="stylesheet" href="css/style.css" />',
    "<style>\n" + css + "\n</style>",
)
html = html.replace(
    '<script src="js/game.js"></script>',
    "<script>\n" + js + "\n</script>",
)
html = html.replace(
    'src="assets/bg-beach.png"',
    'src="data:image/png;base64,' + bg_b64 + '"',
)

OUT.write_text(html, encoding="utf-8")
print("written:", OUT, round(OUT.stat().st_size / 1024), "KB")
