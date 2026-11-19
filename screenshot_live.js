import puppeteer from 'puppeteer';

(async () => {
  console.log('Capturing live production UI...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Dashboard desktop
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('https://luminadesk-gary.netlify.app/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: 'C:\\Users\\zigac\\.gemini\\antigravity\\brain\\d09993d0-1815-43ea-90e6-16b16022bd0e\\live_dashboard.png' });

  // Carlota Mendoza profile top
  await page.goto('https://luminadesk-gary.netlify.app/clients/3', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: 'C:\\Users\\zigac\\.gemini\\antigravity\\brain\\d09993d0-1815-43ea-90e6-16b16022bd0e\\live_carlota_header.png' });

  // Carlota Mendoza profile scrolled to gallery & bonos
  await page.evaluate(() => {
    const main = document.querySelector('main');
    if (main) main.scrollTo(0, 950);
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: 'C:\\Users\\zigac\\.gemini\\antigravity\\brain\\d09993d0-1815-43ea-90e6-16b16022bd0e\\live_carlota_treatments.png' });

  await browser.close();
  console.log('Captures completed.');
})();
