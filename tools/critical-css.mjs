// 初期表示（スマホ375×812の1.6画面分）に必要なCSSだけを抜き出す
// 使い方: node tools/critical-css.mjs <URL> <出力css>
//   例: node tools/critical-css.mjs http://127.0.0.1:8765/index-b.html /tmp/critical-b.css
// 依存: puppeteer-core（scratchpad等に npm i puppeteer-core@23 して NODE_PATH で渡す）
import puppeteer from 'puppeteer-core';
import fs from 'fs';
const [url, out] = process.argv.slice(2);
const W = 375, H = 812;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
const css = await page.evaluate((H) => {
  const limit = H * 1.6; // 1画面目＋少し下まで
  const fontsUsed = new Set();
  const keyframesUsed = new Set();
  function visible(el) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    return r.top < limit && r.bottom > -1;
  }
  function selectorHits(sel) {
    const base = sel.replace(/::?(before|after|placeholder|selection|marker)\b/g, '').replace(/:(hover|focus|focus-visible|active|visited)\b/g, '').trim();
    if (!base || /^(html|body|:root|\*)$/.test(base)) return true;
    let els;
    try { els = document.querySelectorAll(base); } catch (e) { return false; }
    for (const el of els) {
      if (el.closest('[hidden], .consent')) continue; // モーダルは初期表示に不要（追従ボタンは1画面目に見えるので含める）
      if (visible(el)) {
        const cs = getComputedStyle(el);
        fontsUsed.add(cs.fontFamily.split(',')[0].replace(/["']/g, '').trim() + '|' + cs.fontWeight);
        if (cs.animationName && cs.animationName !== 'none') cs.animationName.split(',').forEach(n => keyframesUsed.add(n.trim()));
        return true;
      }
    }
    return false;
  }
  function walk(rules) {
    let s = '';
    for (const r of rules) {
      if (r.type === CSSRule.STYLE_RULE) {
        const sels = r.selectorText.split(',').map(x => x.trim()).filter(selectorHits);
        if (sels.length) s += sels.join(',') + '{' + r.style.cssText + '}\n';
      } else if (r.type === CSSRule.MEDIA_RULE) {
        const inner = walk(r.cssRules);
        if (inner.trim()) s += '@media ' + r.conditionText + '{\n' + inner + '}\n';
      } else if (r.type === CSSRule.SUPPORTS_RULE) {
        const inner = walk(r.cssRules);
        if (inner.trim()) s += '@supports ' + r.conditionText + '{\n' + inner + '}\n';
      }
    }
    return s;
  }
  let body = '';
  const fontFaces = [], keyframes = [];
  for (const sheet of document.styleSheets) {
    if (sheet.ownerNode && sheet.ownerNode.id === 'critical-css') continue; // 前回の埋め込み分は読まない
    let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
    body += walk(rules);
    for (const r of rules) {
      if (r.type === CSSRule.FONT_FACE_RULE) fontFaces.push(r);
      if (r.type === CSSRule.KEYFRAMES_RULE) keyframes.push(r);
    }
  }
  // @font-face は <link rel="preload" as="font"> しているものだけ埋め込む（他は本体CSS読込後に読まれる。重複定義は除外）
  const preloaded = [...document.querySelectorAll('link[rel="preload"][as="font"]')].map(l => l.getAttribute('href').split('/').pop());
  const seenFace = new Set();
  const ff = fontFaces.filter(r => {
    const key = r.style.getPropertyValue('font-family').replace(/["']/g, '').trim() + '|' + (r.style.getPropertyValue('font-weight') || '400');
    const file = (r.style.getPropertyValue('src').match(/fonts\/([^"')]+)/) || [])[1];
    if (!fontsUsed.has(key) || !preloaded.includes(file) || seenFace.has(key)) return false;
    seenFace.add(key); return true;
  }).map(r => r.cssText.replace(/url\("?\.\.\/fonts\//g, 'url("fonts/').replace(/url\(fonts\//g, 'url("fonts/')).join('\n');
  const kf = keyframes.filter(r => keyframesUsed.has(r.name)).map(r => r.cssText).join('\n');
  return { css: ff + '\n' + kf + '\n' + body, fonts: [...fontsUsed], keyframes: [...keyframesUsed] };
}, H);
await browser.close();
fs.writeFileSync(out, css.css);
console.log('fonts:', css.fonts.join(', '));
console.log('keyframes:', css.keyframes.join(', '));
console.log('bytes:', Buffer.byteLength(css.css));
