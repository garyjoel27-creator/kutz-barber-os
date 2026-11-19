import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto('https://luminadesk-gary.netlify.app/clients/3', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));
  
  // Click on Galería Antes / Después tab
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && text.includes('Galería Antes / Después')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1500));
  await page.evaluate(() => {
    const main = document.querySelector('main');
    if (main) main.scrollTo(0, 400);
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'C:\\Users\\zigac\\.gemini\\antigravity\\brain\\d09993d0-1815-43ea-90e6-16b16022bd0e\\live_carlota_gallery.png' });
  await browser.close();
  console.log('Gallery capture complete');
})();
