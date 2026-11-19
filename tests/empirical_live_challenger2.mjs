import assert from 'node:assert';
import puppeteer from 'puppeteer';

const TARGET_URL = 'https://luminadesk-gary.netlify.app';

const VIEWPORTS = [
  { name: 'Mobile (iPhone 12/13/14)', width: 390, height: 844 },
  { name: 'Tablet (iPad Mini / Air)', width: 768, height: 1024 },
  { name: 'Desktop (1280p)', width: 1280, height: 800 }
];

async function runEmpiricalStressTest() {
  console.log('================================================================');
  console.log('EMPIRICAL CHALLENGER 2: LIVE PRODUCTION STRESS & UI VERIFICATION');
  console.log(`Target URL: ${TARGET_URL}`);
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const testReport = {
    url: TARGET_URL,
    timestamp: new Date().toISOString(),
    routesChecked: [],
    viewportsChecked: [],
    flipInteraction: null,
    runtimeErrors: [],
    passed: false
  };

  try {
    const page = await browser.newPage();

    // Collect all console logs and page errors
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        console.error(`[Browser Console Error]: ${text}`);
        testReport.runtimeErrors.push({ type: 'console.error', text });
      }
    });

    page.on('pageerror', err => {
      console.error(`[Browser Page Error]: ${err.message}`);
      testReport.runtimeErrors.push({ type: 'pageerror', text: err.message });
    });

    // =========================================================================
    // STEP 1: TEST LIVE PRODUCTION DOM & ROUTE NAVIGATION (DESKTOP BASELINE)
    // =========================================================================
    console.log('>>> TEST 1: LIVE DOM & ROUTE NAVIGATION (DESKTOP 1280x800)');
    await page.setViewport({ width: 1280, height: 800 });

    // 1.1 Root Route '/'
    console.log(`1.1 Navigating to ${TARGET_URL}...`);
    const rootRes = await page.goto(TARGET_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    assert.strictEqual(rootRes.status(), 200, 'Root response status must be 200 OK');
    const title = await page.title();
    console.log(`    Page title: "${title}"`);
    assert.ok(title.includes('KUTZ // BARBER OS'), 'Title must contain KUTZ // BARBER OS');

    // Verify Zone A: Real-Time Chairs
    const zoneATitle = await page.$eval('body', el => el.innerText.includes('ESTADO DE SILLONES EN TIEMPO REAL'));
    assert.ok(zoneATitle, 'Zone A: Real-Time Chairs header must be rendered');
    const chairCount = await page.evaluate(() => {
      const chairs = Array.from(document.querySelectorAll('*')).filter(el => 
        el.innerText && el.innerText.includes('SILLÓN 0')
      );
      return chairs.length;
    });
    console.log(`    Zone A: Real-Time Chairs detected (at least ${chairCount} occurrences)`);
    assert.ok(chairCount >= 1, 'Zone A must render barber chair stations');

    // Test Chair Status Cycling
    console.log('    Testing Chair Status Cycling on CH-01...');
    const initialBadgeText = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => 
        b.innerText && (b.innerText.includes('EN CORTE') || b.innerText.includes('WALK-IN') || b.innerText.includes('RITUAL'))
      );
      return btn ? btn.innerText.trim() : null;
    });
    assert.ok(initialBadgeText, 'A chair status badge button must be present on dashboard');
    console.log(`    Initial chair status badge: "${initialBadgeText}"`);

    // Click badge to cycle status
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => 
        b.innerText && (b.innerText.includes('EN CORTE') || b.innerText.includes('WALK-IN') || b.innerText.includes('RITUAL'))
      );
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 400));
    const cycledBadgeText = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => 
        b.innerText && (b.innerText.includes('EN CORTE') || b.innerText.includes('WALK-IN') || b.innerText.includes('RITUAL'))
      );
      return btn ? btn.innerText.trim() : null;
    });
    console.log(`    Cycled chair status badge: "${cycledBadgeText}"`);
    assert.notStrictEqual(initialBadgeText, cycledBadgeText, 'Clicking chair badge must update status in state');

    // Verify Zone B: Live Queue
    const zoneBTitle = await page.$eval('body', el => el.innerText.includes('COLA VIVA // WALK-INS'));
    assert.ok(zoneBTitle, 'Zone B: Live Walk-In Queue header must be rendered');
    console.log('    Zone B: Live Walk-In Queue mounted');

    // Verify Zone C: Daily Clients Bento Cards
    const zoneCTitle = await page.$eval('body', el => el.innerText.includes('CLIENTES DEL DÍA // RETOQUE DE FADE & CARDS 3D'));
    assert.ok(zoneCTitle, 'Zone C: Daily Clients header must be rendered');
    const dashboardCards = await page.evaluate(() => document.querySelectorAll('.perspective-1000').length);
    console.log(`    Zone C: 3D Bento Cards mounted on Dashboard: ${dashboardCards} cards`);
    assert.ok(dashboardCards >= 3, 'Zone C must render at least 3 Bento 3D cards');
    testReport.routesChecked.push({ route: '/', status: rootRes.status(), title, dashboardCards });

    // 1.2 Clients Route '/clients'
    console.log(`\n1.2 Navigating to ${TARGET_URL}/clients...`);
    const clientsRes = await page.goto(`${TARGET_URL}/clients`, { waitUntil: 'networkidle0', timeout: 30000 });
    assert.strictEqual(clientsRes.status(), 200, 'Clients route response status must be 200 OK');
    const clientsHeader = await page.$eval('body', el => el.innerText.includes('DIRECTORIO DE CLIENTES & RECETAS FADE'));
    assert.ok(clientsHeader, 'Clients directory header must be rendered');

    const clientsCards = await page.evaluate(() => document.querySelectorAll('.perspective-1000').length);
    console.log(`    Bento Grid cards on /clients: ${clientsCards} cards`);
    assert.ok(clientsCards >= 3, 'Bento Grid on /clients must render at least 3 cards');

    // Verify Álex Rivera card exists
    const hasAlexRivera = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes('álex rivera') || text.includes('alex rivera');
    });
    assert.ok(hasAlexRivera, "Álex Rivera's card must be present on /clients");
    console.log('    ✔ Álex Rivera card found in Bento Grid');
    testReport.routesChecked.push({ route: '/clients', status: clientsRes.status(), cardsMounted: clientsCards });

    // =========================================================================
    // STEP 2: TEST 3D FLIP CARD INTERACTION (ÁLEX RIVERA)
    // =========================================================================
    console.log('\n>>> TEST 2: 3D FLIP CARD INTERACTION ON ÁLEX RIVERA');

    // Find Álex Rivera's card wrapper and inner 3D container
    const alexCardDetails = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.perspective-1000'));
      for (const card of cards) {
        if (card.innerText.toLowerCase().includes('alex rivera') || card.innerText.toLowerCase().includes('álex rivera')) {
          const inner3d = card.querySelector('.transform-style-3d');
          const flipBtn = Array.from(card.querySelectorAll('button')).find(b => 
            b.innerText.toLowerCase().includes('voltear')
          );
          return {
            found: true,
            hasPerspective: card.classList.contains('perspective-1000'),
            hasTransformStyle3d: inner3d ? inner3d.classList.contains('transform-style-3d') : false,
            initialClasses: inner3d ? inner3d.className : '',
            hasFlipBtn: !!flipBtn
          };
        }
      }
      return { found: false };
    });

    assert.ok(alexCardDetails.found, "Álex Rivera's card element must be found");
    assert.ok(alexCardDetails.hasPerspective, 'Card container must have .perspective-1000');
    assert.ok(alexCardDetails.hasTransformStyle3d, 'Inner container must have .transform-style-3d');
    assert.ok(alexCardDetails.hasFlipBtn, 'Flip button must be present on front face');
    console.log('    Card wrapper verified: perspective-1000 + transform-style-3d');
    console.log(`    Initial classes: ${alexCardDetails.initialClasses}`);
    assert.ok(!alexCardDetails.initialClasses.includes('rotate-y-180'), 'Card must initially NOT be rotated 180deg');

    // Trigger Flip on Álex Rivera's card
    console.log('    Triggering flip on Álex Rivera card...');
    const flipTriggered = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.perspective-1000'));
      for (const card of cards) {
        if (card.innerText.toLowerCase().includes('alex rivera') || card.innerText.toLowerCase().includes('álex rivera')) {
          const flipBtn = Array.from(card.querySelectorAll('button')).find(b => 
            b.innerText.toLowerCase().includes('voltear')
          );
          if (flipBtn) {
            flipBtn.click();
            return true;
          }
        }
      }
      return false;
    });
    assert.ok(flipTriggered, 'Flip trigger button clicked');

    // Wait for 3D flip animation transition (600ms)
    await new Promise(r => setTimeout(r, 700));

    // Verify 180° rotation and back face visibility
    const flippedState = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.perspective-1000'));
      for (const card of cards) {
        if (card.innerText.toLowerCase().includes('alex rivera') || card.innerText.toLowerCase().includes('álex rivera')) {
          const inner3d = card.querySelector('.transform-style-3d');
          const computedStyle = window.getComputedStyle(inner3d);
          const text = card.innerText.toLowerCase();
          return {
            classes: inner3d.className,
            transform: computedStyle.transform,
            hasRotateClass: inner3d.classList.contains('rotate-y-180'),
            hasFormula: text.includes('#000') || text.includes('shaver') || text.includes('fórmula') || text.includes('ficha técnica'),
            hasPeines: text.includes('#0.5') && text.includes('#1.5') && (text.includes('#2 / #3') || text.includes('conexión')),
            hasQuickLogger: text.includes('registrar corte rápido') || text.includes('guardar')
          };
        }
      }
      return null;
    });

    assert.ok(flippedState, 'Flipped card state must be inspectable');
    console.log(`    Post-flip classes: ${flippedState.classes}`);
    console.log(`    Post-flip computed transform: ${flippedState.transform}`);
    assert.ok(flippedState.hasRotateClass, 'Card inner element must have rotate-y-180 class');
    assert.ok(flippedState.hasFormula, 'Back face must expose technical formula / Ficha Técnica');
    assert.ok(flippedState.hasPeines, 'Back face must expose peines graduation (#0.5, #1.5, #2 / #3)');
    assert.ok(flippedState.hasQuickLogger, 'Back face must expose inline quick logger');
    console.log('    ✔ 3D Flip Card turned 180° revealing technical formula and peines on live production');

    // Flip back to front face
    console.log('    Flipping back to front face...');
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.perspective-1000'));
      for (const card of cards) {
        if (card.innerText.toLowerCase().includes('alex rivera') || card.innerText.toLowerCase().includes('álex rivera')) {
          const backFlipBtn = card.querySelector('button[title="Volver a cara frontal"]');
          if (backFlipBtn) backFlipBtn.click();
        }
      }
    });
    await new Promise(r => setTimeout(r, 700));

    const revertedState = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.perspective-1000'));
      for (const card of cards) {
        if (card.innerText.toLowerCase().includes('alex rivera') || card.innerText.toLowerCase().includes('álex rivera')) {
          const inner3d = card.querySelector('.transform-style-3d');
          return {
            hasRotateY180: inner3d.classList.contains('rotate-y-180'),
            hasRotateY0: inner3d.classList.contains('rotate-y-0')
          };
        }
      }
      return null;
    });
    assert.ok(!revertedState.hasRotateY180, 'Card must no longer have rotate-y-180 after flipping back');
    assert.ok(revertedState.hasRotateY0, 'Card must have rotate-y-0 after flipping back');
    console.log('    ✔ Card successfully flipped back to front face');

    testReport.flipInteraction = {
      card: 'Álex Rivera',
      rotationVerified: true,
      formulaRevealed: true,
      revertVerified: true
    };

    // =========================================================================
    // STEP 3: RESPONSIVE VIEWPORT STRESS TESTING (390px, 768px, 1280px)
    // =========================================================================
    console.log('\n>>> TEST 3: RESPONSIVE VIEWPORT STRESS TESTING');

    for (const vp of VIEWPORTS) {
      console.log(`\n--- Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
      await page.setViewport({ width: vp.width, height: vp.height });

      // 3.1 Check Dashboard '/'
      console.log(`    Navigating to / at ${vp.width}px...`);
      await page.goto(TARGET_URL, { waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 500));

      const dashboardMetrics = await page.evaluate((expectedWidth) => {
        const bodyWidth = document.body.scrollWidth;
        const htmlWidth = document.documentElement.scrollWidth;
        const windowWidth = window.innerWidth;
        const hasHorizontalScroll = (htmlWidth - windowWidth) > 1 || (bodyWidth - windowWidth) > 1;
        const chairsVisible = Array.from(document.querySelectorAll('*')).some(el => el.innerText && el.innerText.includes('SILLÓN'));
        const cardsCount = document.querySelectorAll('.perspective-1000').length;
        return {
          windowWidth,
          htmlWidth,
          bodyWidth,
          hasHorizontalScroll,
          chairsVisible,
          cardsCount
        };
      }, vp.width);

      console.log(`    Dashboard layout: windowWidth=${dashboardMetrics.windowWidth}, scrollWidth=${dashboardMetrics.htmlWidth}, overflow=${dashboardMetrics.hasHorizontalScroll}`);
      assert.strictEqual(dashboardMetrics.hasHorizontalScroll, false, `Dashboard at ${vp.width}px must NOT have horizontal scroll overflow!`);
      assert.ok(dashboardMetrics.chairsVisible, `Chairs must be visible at ${vp.width}px`);
      assert.ok(dashboardMetrics.cardsCount >= 3, `Cards must be rendered at ${vp.width}px`);

      // 3.2 Check Clients '/clients'
      console.log(`    Navigating to /clients at ${vp.width}px...`);
      await page.goto(`${TARGET_URL}/clients`, { waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 500));

      const clientsMetrics = await page.evaluate((expectedWidth) => {
        const bodyWidth = document.body.scrollWidth;
        const htmlWidth = document.documentElement.scrollWidth;
        const windowWidth = window.innerWidth;
        const hasHorizontalScroll = (htmlWidth - windowWidth) > 1 || (bodyWidth - windowWidth) > 1;
        const cardsCount = document.querySelectorAll('.perspective-1000').length;
        return {
          windowWidth,
          htmlWidth,
          bodyWidth,
          hasHorizontalScroll,
          cardsCount
        };
      }, vp.width);

      console.log(`    Clients layout: windowWidth=${clientsMetrics.windowWidth}, scrollWidth=${clientsMetrics.htmlWidth}, overflow=${clientsMetrics.hasHorizontalScroll}`);
      assert.strictEqual(clientsMetrics.hasHorizontalScroll, false, `Clients page at ${vp.width}px must NOT have horizontal scroll overflow!`);
      assert.ok(clientsMetrics.cardsCount >= 3, `Clients cards must be rendered at ${vp.width}px`);

      // 3.3 Test 3D Flip at this viewport
      console.log(`    Testing card flip interaction at ${vp.width}px...`);
      const vpFlipSuccess = await page.evaluate(() => {
        const firstCard = document.querySelector('.perspective-1000');
        if (!firstCard) return false;
        const flipBtn = firstCard.querySelector('button[title*="Girar"]') || Array.from(firstCard.querySelectorAll('button')).find(b => b.innerText.includes('Voltear'));
        if (flipBtn) {
          flipBtn.click();
          return true;
        }
        return false;
      });
      assert.ok(vpFlipSuccess, `Card flip button must be clickable at ${vp.width}px`);
      await new Promise(r => setTimeout(r, 700));

      const isFlippedAtVp = await page.evaluate(() => {
        const firstCard = document.querySelector('.perspective-1000 .transform-style-3d');
        return firstCard && firstCard.classList.contains('rotate-y-180');
      });
      assert.ok(isFlippedAtVp, `Card must flip to 180° at ${vp.width}px`);
      console.log(`    ✔ Card flip verified at ${vp.width}px`);

      testReport.viewportsChecked.push({
        viewport: vp.name,
        width: vp.width,
        height: vp.height,
        dashboardOverflow: dashboardMetrics.hasHorizontalScroll,
        clientsOverflow: clientsMetrics.hasHorizontalScroll,
        flipSuccess: isFlippedAtVp
      });
    }

    // =========================================================================
    // STEP 4: RUNTIME CONSOLE ERROR AUDIT
    // =========================================================================
    console.log('\n>>> TEST 4: RUNTIME CONSOLE ERROR AUDIT');
    // Filter out irrelevant external noise (like external font 404s if any)
    const fatalErrors = testReport.runtimeErrors.filter(e => {
      const msg = e.text.toLowerCase();
      return !msg.includes('favicon') && !msg.includes('font');
    });

    console.log(`    Total console errors detected: ${testReport.runtimeErrors.length}`);
    console.log(`    Fatal app runtime errors: ${fatalErrors.length}`);
    if (fatalErrors.length > 0) {
      console.error('Fatal errors found:', fatalErrors);
    }
    assert.strictEqual(fatalErrors.length, 0, `Expected 0 fatal runtime console errors, got ${fatalErrors.length}`);
    console.log('    ✔ 0 fatal runtime console errors on live production site');

    testReport.passed = true;
    console.log('\n================================================================');
    console.log('EMPIRICAL CHALLENGER 2: ALL EMPIRICAL CHECKS PASSED WITH 100% SUCCESS');
    console.log('================================================================');

    return testReport;
  } finally {
    await browser.close();
  }
}

runEmpiricalStressTest().then(report => {
  console.log('\nTest Report Summary:\n', JSON.stringify(report, null, 2));
  process.exit(0);
}).catch(err => {
  console.error('\n❌ EMPIRICAL CHALLENGE FAILED:', err);
  process.exit(1);
});
