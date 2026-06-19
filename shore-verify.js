const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--ignore-gpu-blocklist','--use-gl=swiftshader','--enable-webgl'] });
  const page = await browser.newPage();
  page.on('console', m => console.log('PAGE LOG:', m.type(), m.text()));
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  await page.goto('http://localhost:8765/example-shoreline-nodes.html', { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'C:/Users/ibrah/AppData/Local/Temp/shore-1.png' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'C:/Users/ibrah/AppData/Local/Temp/shore-2.png' });
  await browser.close();
})();
