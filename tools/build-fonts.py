#!/usr/bin/env python3
"""LPで使っている文字だけを含むサブセットWebフォント(woff2)を fonts/ に再生成する。

使い方（LPフォルダで）:
  pip3 install --user fonttools brotli   # 初回のみ
  python3 tools/build-fonts.py

index.html / index-b.html / css 内の文字を集計し、Google Fonts から元フォントを
取得してサブセット化します。本文の文字を追加・変更したら必ず実行してください
（サブセットに無い文字は端末フォントで表示されてしまいます）。
"""
import html, os, re, string, subprocess, sys, tempfile, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = [  # (Google Fonts クエリ, 出力ファイル名)
    ("M+PLUS+1p:wght@500", "mplus1p-500.woff2"),
    ("M+PLUS+1p:wght@700", "mplus1p-700.woff2"),
    ("M+PLUS+1p:wght@800", "mplus1p-800.woff2"),
    ("Noto+Sans+JP:wght@400", "notosansjp-400.woff2"),
    ("Poppins:wght@500", "poppins-500.woff2"),
    ("Poppins:wght@600", "poppins-600.woff2"),
    ("Zen+Kurenaido", "zenkurenaido-400.woff2"),
    ("Shippori+Mincho:wght@500", "shipporimincho-500.woff2"),
]
# 古いUAを名乗ると unicode-range 分割なしの1ファイル(WOFF)が返る
UA = "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:30.0) Gecko/20100101 Firefox/30.0"
EXTRA = string.printable + "。、「」『』（）！？：；・〜ー…“”‘’〒※→←↑↓○●◎△▲□■☆★♩♪々〇０１２３４５６７８９"


def collect_chars():
    chars = set(EXTRA)
    for name in os.listdir(ROOT):
        if name.endswith(".html"):
            s = open(os.path.join(ROOT, name), encoding="utf-8").read()
            s = re.sub(r"<script.*?</script>|<style.*?</style>", "", s, flags=re.S)
            s = html.unescape(re.sub(r"<[^>]+>", " ", s))
            chars.update(s)
    for name in os.listdir(os.path.join(ROOT, "css")):
        css = open(os.path.join(ROOT, "css", name), encoding="utf-8").read()
        for m in re.findall(r'content:\s*"([^"]*)"', css):
            chars.update(m)
    return "".join(sorted(c for c in chars if not c.isspace() or c == " "))


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def main():
    chars = collect_chars()
    print(f"使用文字数: {len(chars)}")
    os.makedirs(os.path.join(ROOT, "fonts"), exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        charfile = os.path.join(tmp, "chars.txt")
        open(charfile, "w", encoding="utf-8").write(chars)
        for query, out in FONTS:
            css = fetch(f"https://fonts.googleapis.com/css2?family={query}").decode()
            src = re.search(r"https://fonts\.gstatic\.com[^)]+", css).group(0)
            raw = os.path.join(tmp, out + ".src")
            open(raw, "wb").write(fetch(src))
            dst = os.path.join(ROOT, "fonts", out)
            subprocess.run([sys.executable, "-m", "fontTools.subset", raw,
                            f"--text-file={charfile}", "--flavor=woff2", "--layout-features=*",
                            "--no-hinting", "--desubroutinize", f"--output-file={dst}"], check=True)
            print(f"  {out}: {os.path.getsize(dst)//1024} KB")
    print("完了。CSSの ?v= を更新してpushしてください。")


if __name__ == "__main__":
    main()
