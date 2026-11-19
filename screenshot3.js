import puppeteer from 'puppeteer';

(async () => {
  console.log('Starting puppeteer for Phase 3...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Mobile View for Profile
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.goto('http://127.0.0.1:5173/clients/1');
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'C:\\Users\\zigac\\.gemini\\antigravity\\brain\\d09993d0-1815-43ea-90e6-16b16022bd0e\\profile_mobile.png' });

  // Desktop view for Profile
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://127.0.0.1:5173/clients/1');
  await new Promise(r => setTimeout(r, 2000));
  // Simulate moving mouse to 60% of the slider to show the interaction
  await page.mouse.move(768, 600); // approximate coordinates over the slider
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: 'C:\\Users\\zigac\\.gemini\\antigravity\\brain\\d09993d0-1815-43ea-90e6-16b16022bd0e\\profile_desktop.png' });

  await browser.close();
  console.log('Phase 3 Screenshots taken successfully.');
})();
