#!/usr/bin/env python3
"""初期表示用CSS（critical-css.mjs の出力）を <style id="critical-css"> に埋め込み直す。
使い方: python3 tools/inline-critical.py index-b.html <critical.css>
手順: 1) ローカルサーバー起動 2) node critical-css.mjs http://127.0.0.1:8765/index-b.html out.css 3) 本スクリプト
CSSを変更したら v= を上げるのと合わせて毎回やり直すこと。"""
import re, sys
html_path, css_path = sys.argv[1], sys.argv[2]
css = open(css_path, encoding='utf-8').read()
css = re.sub(r'\s*\n\s*', '', css).replace('; ', ';').replace(': ', ':').replace('{ ', '{').replace(' }', '}')
html = open(html_path, encoding='utf-8').read()
new = '<style id="critical-css">' + css + '</style>'
if '<style id="critical-css">' in html:
    html, n = re.subn(r'<style id="critical-css">.*?</style>', lambda m: new, html, count=1, flags=re.S)
else:
    html, n = re.subn(r'(<link rel="stylesheet" href="css/style-b\.css\?v=[^"]+">)',
        lambda m: new + '\n' + m.group(1), html, count=1)
assert n == 1, 'critical-css の挿入位置が見つかりません'
open(html_path, 'w', encoding='utf-8').write(html)
print('inlined', len(css), 'bytes')
