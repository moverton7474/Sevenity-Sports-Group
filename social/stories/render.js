// Render a 1080x1920 story page to PNG.
//   node social/stories/render.js <story.html> <out.png>
// Draws at 2x and downsamples in-browser for crisp type, and refuses to write
// the file if any font failed to load (a fallback serif is easy to miss).
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }

(async () => {
  const [html, out] = process.argv.slice(2).map(p => path.resolve(p));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 2 });
  await page.goto('file://' + html, { waitUntil: 'networkidle' });
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.fonts].map(f => f.load().catch(() => {})));
    return [...document.fonts].map(f => `${f.family} ${f.style}: ${f.status}`);
  });
  const bad = fonts.filter(f => !f.endsWith('loaded'));
  if (!fonts.length || bad.length) { console.error('Fonts not loaded:', bad.length ? bad : 'none declared'); process.exit(1); }

  const shot = (await page.screenshot()).toString('base64');
  const png = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
    const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, 1080, 1920);
    return c.toDataURL('image/png').split(',')[1];
  }, shot);
  require('fs').writeFileSync(out, Buffer.from(png, 'base64'));
  console.log('wrote', out, '\n ', fonts.join('\n  '));
  await browser.close();
})();
