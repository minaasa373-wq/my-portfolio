// フレーム書き出し: node render_frames.js <cues.json> <出力フォルダ> <はみ出しレポート.json>
// frame.html（見た目のテンプレート）と illustrations.js（コードで描いた画像）を Chromium で描画して PNG にする。
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = __dirname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.ttf': 'font/ttf' };

async function main() {
  const [cuesPath, outDir, reportPath] = process.argv.slice(2);
  const cues = JSON.parse(fs.readFileSync(cuesPath, 'utf8'));
  fs.mkdirSync(outDir, { recursive: true });

  // フォントを読み込むため、制作フォルダをローカル HTTP で配信する
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${server.address().port}/frame.html`);
  const fontsOk = await page.evaluate(async () => {
    await Promise.all([document.fonts.load('900 100px MPR', 'あ'), document.fonts.load('800 60px MPR', 'あ')]);
    return document.fonts.check('900 100px MPR', 'あ') && document.fonts.check('800 60px MPR', 'あ');
  });
  if (!fontsOk) throw new Error('フォント（assets/fonts/）が読み込めません。fetch_assets.sh を実行してください');

  const report = [];
  for (const c of cues) {
    const checks = await page.evaluate(async (cue) => {
      renderCue(cue);
      await document.fonts.ready;
      return fitAndCheck(cue.cue);
    }, c);
    report.push(...checks);
    await page.screenshot({ path: path.join(outDir, `${c.cue}.png`) });
  }
  await browser.close();
  server.close();

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 1));
  if (errors.length) throw new Error('描画エラー: ' + errors.join('\n'));
  const bad = report.filter((r) => !r.ok);
  if (bad.length) {
    console.error('はみ出し・重なり:', JSON.stringify(bad, null, 1));
    process.exit(1);
  }
  console.log(`${cues.length} フレームを書き出し（文字の実測 ${report.length} 件、はみ出しなし）`);
}

main().catch((e) => { console.error(e); process.exit(1); });
