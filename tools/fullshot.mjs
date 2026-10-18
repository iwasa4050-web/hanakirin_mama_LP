// LP全体を1枚の縦長画像で保存する（幅375px・2倍解像度・追従CTAは非表示）
// 使い方: cd tools && npm i puppeteer-core@23 && node fullshot.mjs <URL> <出力prefix>
//   → <出力prefix>.parts/ に画面ごとの画像、結合は下記 Python と同じ手順（PIL）で行う
import puppeteer from 'puppeteer-core';
import fs from 'fs';
const [url, out] = process.argv.slice(2);
const W = 375, H = 800, DPR = 2;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
await page.evaluate(async () => {
  document.documentElement.style.scrollBehavior = 'auto';
  const h = document.documentElement.scrollHeight;
  for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 100)); }
  window.scrollTo(0, 0);
  document.querySelectorAll('[class*="float"]').forEach(e => { if (getComputedStyle(e).position === 'fixed') e.style.display = 'none'; });
  document.querySelectorAll('.ps').forEach(e => e.classList.add('is-bg', 'is-open'));
  await new Promise(r => setTimeout(r, 1500));
});
const total = await page.evaluate(() => document.documentElement.scrollHeight);
const dir = out + '.parts'; fs.mkdirSync(dir, { recursive: true });
let i = 0;
for (let y = 0; y < total; y += H) {
  await page.evaluate(y => window.scrollTo(0, y), y);
  await new Promise(r => setTimeout(r, 250));
  const actual = await page.evaluate(() => window.scrollY);
  await page.screenshot({ path: `${dir}/${String(i).padStart(3, '0')}.png` });
  fs.appendFileSync(`${dir}/offsets.txt`, `${i} ${y} ${actual}\n`);
  i++;
}
console.log('total', total, 'parts', i);
await browser.close();
