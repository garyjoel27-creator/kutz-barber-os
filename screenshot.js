import puppeteer from 'puppeteer';

(async () => {
  console.log('Starting puppeteer...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Mobile View
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.goto('http://192.168.1.19:5173');
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: 'C:\\Users\\zigac\\.gemini\\antigravity\\brain\\d09993d0-1815-43ea-90e6-16b16022bd0e\\dashboard_mobile.png' });

  await page.goto('http://192.168.1.19:5173/clients');
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: 'C:\\Users\\zigac\\.gemini\\antigravity\\brain\\d09993d0-1815-43ea-90e6-16b16022bd0e\\clients_mobile.png' });

  // Desktop view
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://192.168.1.19:5173');
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: 'C:\\Users\\zigac\\.gemini\\antigravity\\brain\\d09993d0-1815-43ea-90e6-16b16022bd0e\\dashboard_desktop.png' });

  await page.goto('http://192.168.1.19:5173/clients');
  await new Promise(r => setTimeout(r, 1500));
  
  // Click on "Nuevo Cliente"
  const buttons = await page.$$('button');
  for (const button of buttons) {
    const text = await page.evaluate(el => el.textContent, button);
    if (text.includes('Nuevo Cliente')) {
      await button.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: 'C:\\Users\\zigac\\.gemini\\antigravity\\brain\\d09993d0-1815-43ea-90e6-16b16022bd0e\\modal_desktop.png' });

  await browser.close();
  console.log('Screenshots taken successfully.');
})();
