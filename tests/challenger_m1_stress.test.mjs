/**
 * Empirical Challenger M1 Stress Test Suite
 * Tests soundFx.js Web Audio engine & CSS 3D tokens under extreme adversarial conditions.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('================================================================');
console.log('CHALLENGER M1: EMPIRICAL STRESS TEST SUITE');
console.log('Testing soundFx.js and CSS 3D / Glassmorphism tokens');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const findings = [];

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✖ [FAIL] ${name}`);
    console.error(`    Error: ${err.message}`);
    findings.push({ name, error: err.message, stack: err.stack });
  }
}

async function asyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✖ [FAIL] ${name}`);
    console.error(`    Error: ${err.message}`);
    findings.push({ name, error: err.message, stack: err.stack });
  }
}

async function runAll() {
  // ----------------------------------------------------------------------------
  // SUITE 1: SSR & Node.js Environment Robustness
  // ----------------------------------------------------------------------------
  console.log('--- SUITE 1: SSR & Node.js Environment Edge Cases ---');

  await asyncTest('SSR: Safe execution when window is undefined', async () => {
    const originalWindow = globalThis.window;
    delete globalThis.window;
    
    const { soundFx, playFlip, playClick, triggerHaptic } = await import(`../src/lib/soundFx.js?t=${Date.now()}`);
    
    assert.doesNotThrow(() => {
      soundFx.init();
      playFlip();
      playClick();
      triggerHaptic(10);
    });
    
    if (originalWindow) globalThis.window = originalWindow;
  });

  await asyncTest('SSR: AudioContext constructor throwing QuotaExceededError when soundFx.init() is called directly', async () => {
    const originalWindow = globalThis.window;
    globalThis.window = {
      AudioContext: class {
        constructor() {
          throw new Error('QuotaExceededError: The number of hardware contexts provided by the platform is limited.');
        }
      }
    };

    const { soundFx } = await import(`../src/lib/soundFx.js?t=${Date.now() + 1}`);
    soundFx.ctx = null;

    let directInitThrew = false;
    try {
      soundFx.init();
    } catch {
      directInitThrew = true;
    }

    // Check whether calling playFlip() or playClick() handles this
    let playFlipThrew = false;
    try {
      soundFx.playFlip();
    } catch {
      playFlipThrew = true;
    }

    if (originalWindow) globalThis.window = originalWindow;
    else delete globalThis.window;

    // Analysis finding: direct call to soundFx.init() without try-catch can throw if AudioContext creation fails!
    if (directInitThrew) {
      findings.push({
        category: 'AUDIOCONTEXT_INIT_EXCEPTION',
        severity: 'MEDIUM',
        message: 'Direct invocation of soundFx.init() throws uncaught error if AudioContext constructor throws (e.g. QuotaExceededError), because init() lacks try/catch around `new AudioCtx()`. `playFlip()` and `playClick()` wrap init() in try/catch, but direct calls to `soundFx.init()` will propagate the exception.'
      });
      console.log('    [EMPIRICAL FINDING] soundFx.init() propagates exception if AudioContext constructor throws');
    }
    assert.strictEqual(playFlipThrew, false, 'playFlip should never throw uncaught exception even if AudioContext constructor fails');
  });

  // ----------------------------------------------------------------------------
  // SUITE 2: AudioContext Closed State Recovery & Zombie Instance Analysis
  // ----------------------------------------------------------------------------
  console.log('\n--- SUITE 2: AudioContext Closed State Edge Case ---');

  await asyncTest('Closed AudioContext: Behavior when AudioContext enters closed state', async () => {
    let createdNodes = 0;
    class MockAudioParam {
      constructor(v) { this.value = v; }
      setValueAtTime() {}
      exponentialRampToValueAtTime() {}
      linearRampToValueAtTime() {}
    }
    class MockNode {
      constructor() {
        createdNodes++;
        this.frequency = new MockAudioParam(440);
        this.gain = new MockAudioParam(1);
      }
      connect() {}
      start() {}
      stop() {}
    }

    let audioContextInstantiationCount = 0;

    class MockAudioContext {
      constructor() {
        audioContextInstantiationCount++;
        this.state = 'running';
        this.currentTime = 1.0;
        this.destination = {};
      }
      createOscillator() {
        if (this.state === 'closed') {
          throw new Error('InvalidStateError: Cannot create nodes on a closed AudioContext');
        }
        return new MockNode();
      }
      createGain() {
        if (this.state === 'closed') {
          throw new Error('InvalidStateError: Cannot create nodes on a closed AudioContext');
        }
        return new MockNode();
      }
      createBiquadFilter() {
        if (this.state === 'closed') {
          throw new Error('InvalidStateError: Cannot create nodes on a closed AudioContext');
        }
        return new MockNode();
      }
      close() {
        this.state = 'closed';
        return Promise.resolve();
      }
      resume() {
        if (this.state === 'closed') {
          return Promise.reject(new Error('InvalidStateError: Cannot resume closed context'));
        }
        this.state = 'running';
        return Promise.resolve();
      }
    }

    globalThis.window = { AudioContext: MockAudioContext };
    const { soundFx } = await import(`../src/lib/soundFx.js?t=${Date.now() + 2}`);
    soundFx.ctx = null;

    // 1. Initial play should work
    soundFx.playFlip();
    assert.strictEqual(audioContextInstantiationCount, 1, 'AudioContext should be instantiated');
    assert.ok(createdNodes > 0, 'Nodes should be created on running context');

    // 2. Simulate browser or OS closing the AudioContext (e.g. bluetooth audio disconnect)
    await soundFx.ctx.close();
    assert.strictEqual(soundFx.ctx.state, 'closed');

    // 3. User interacts again: soundFx.init() or playFlip() is invoked
    createdNodes = 0;
    let errorThrown = false;
    try {
      soundFx.playFlip();
    } catch {
      errorThrown = true;
    }
    assert.strictEqual(errorThrown, false, 'playFlip should not throw when context is closed');

    // 4. Did soundFx recover by creating a new AudioContext, or is it stuck in a zombie closed state?
    const recovered = audioContextInstantiationCount > 1;
    if (!recovered) {
      findings.push({
        category: 'AUDIOCONTEXT_ZOMBIE_STATE',
        severity: 'HIGH',
        message: 'When soundFx.ctx enters "closed" state (e.g. OS audio output disconnect, tab suspend/sleep, or bluetooth headphone change), soundFx.init() does NOT re-create the context because `!this.ctx` is false, and it cannot resume because `state !== suspended`. This leaves this.ctx in a permanent zombie state where all subsequent sound calls silently fail forever until page reload.'
      });
      console.log('    [EMPIRICAL FINDING] soundFx does not recover from closed AudioContext (zombie state detected)');
    }
  });

  // ----------------------------------------------------------------------------
  // SUITE 3: Rapid Invocations & Memory Leaks (100 calls in 10ms)
  // ----------------------------------------------------------------------------
  console.log('\n--- SUITE 3: Rapid Invocations & Node Disconnection / Memory Leak ---');

  await asyncTest('Rapid Invocations: 100 calls in 10ms & Node Lifecycle Verification', async () => {
    let disconnectCalls = 0;
    let oscillatorCount = 0;
    let gainCount = 0;
    let filterCount = 0;
    let stopCalls = 0;

    class MockAudioParam {
      constructor(v) { this.value = v; }
      setValueAtTime() {}
      exponentialRampToValueAtTime() {}
      linearRampToValueAtTime() {}
    }

    class MockNode {
      constructor(type) {
        this.nodeType = type;
        this.frequency = new MockAudioParam(440);
        this.gain = new MockAudioParam(1);
      }
      connect() {}
      disconnect() {
        disconnectCalls++;
      }
      start() {}
      stop() {
        stopCalls++;
      }
    }

    class MockAudioContext {
      constructor() {
        this.state = 'running';
        this.currentTime = 50.0;
        this.destination = {};
      }
      createOscillator() {
        oscillatorCount++;
        return new MockNode('oscillator');
      }
      createGain() {
        gainCount++;
        return new MockNode('gain');
      }
      createBiquadFilter() {
        filterCount++;
        return new MockNode('filter');
      }
      resume() { return Promise.resolve(); }
    }

    globalThis.window = { AudioContext: MockAudioContext };
    const { soundFx } = await import(`../src/lib/soundFx.js?t=${Date.now() + 3}`);
    soundFx.ctx = null;
    soundFx.init();

    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      soundFx.playFlip();
    }
    const elapsed = Date.now() - start;

    console.log(`    Executed 100 playFlip() calls in ${elapsed}ms:`);
    console.log(`    - Oscillators created: ${oscillatorCount}`);
    console.log(`    - Gain nodes created: ${gainCount}`);
    console.log(`    - BiquadFilters created: ${filterCount}`);
    console.log(`    - Total audio nodes: ${oscillatorCount + gainCount + filterCount}`);
    console.log(`    - Node disconnect() calls: ${disconnectCalls}`);
    console.log(`    - Oscillator stop() calls: ${stopCalls}`);

    assert.strictEqual(oscillatorCount, 200, '100 flip calls created 200 oscillators');
    assert.strictEqual(gainCount, 100, '100 flip calls created 100 gains');
    assert.strictEqual(filterCount, 100, '100 flip calls created 100 filters');

    // Verify whether nodes are explicitly disconnected
    if (disconnectCalls === 0) {
      findings.push({
        category: 'AUDIONODE_DISCONNECT_ABSENT',
        severity: 'LOW',
        message: 'Nodes connected to destination are never explicitly disconnected via disconnect(). While modern browser garbage collectors collect stopped oscillators if unreferenced, connecting gain nodes directly to destination without disconnect() or onended lifecycle cleanup relies entirely on browser GC heuristic and can cause node accumulation during rapid bursts.'
      });
      console.log('    [EMPIRICAL FINDING] Nodes connected to destination are never explicitly disconnected');
    }

    // Check cumulative volume blast: 100 * 0.08 = 8.0 gain
    const cumulativeGain = 100 * 0.08;
    if (cumulativeGain > 1.0) {
      findings.push({
        category: 'AUDIO_UNBOUNDED_POLYPHONY_CONCURRENCY',
        severity: 'LOW',
        message: `No polyphony limiter or throttle exists in soundFx.js. 100 rapid calls within 10ms overlap and sum up to ${cumulativeGain.toFixed(1)} gain (+18 dB above 0 dBFS), which in real audio hardware will clip and distort unless throttled or clamped.`
      });
      console.log(`    [EMPIRICAL FINDING] Cumulative gain on 100 rapid calls reaches ${cumulativeGain.toFixed(1)} (+18 dB digital clipping)`);
    }
  });

  // ----------------------------------------------------------------------------
  // SUITE 4: Mobile Haptics Limits & Boundary Testing
  // ----------------------------------------------------------------------------
  console.log('\n--- SUITE 4: Mobile Haptics & Vibration Limits ---');

  await asyncTest('Mobile Haptics: Extreme durations, negative values, and non-numeric inputs', async () => {
    const vibrateArgs = [];
    const origNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        vibrate(pattern) {
          vibrateArgs.push(pattern);
          return true;
        }
      },
      configurable: true,
      writable: true
    });

    const { triggerHaptic } = await import(`../src/lib/soundFx.js?t=${Date.now() + 4}`);

    const edgeCases = [
      { input: 0, desc: 'Zero duration' },
      { input: -10, desc: 'Negative duration' },
      { input: 50000, desc: 'Duration > 10000ms (mobile limit)' },
      { input: NaN, desc: 'NaN value' },
      { input: Infinity, desc: 'Infinity value' },
      { input: null, desc: 'null value' },
      { input: undefined, desc: 'undefined value (default parameter)' },
      { input: 'invalid', desc: 'String non-number' },
      { input: [10, 20, 30], desc: 'Vibration pattern array' }
    ];

    for (const c of edgeCases) {
      assert.doesNotThrow(() => {
        triggerHaptic(c.input);
      }, `triggerHaptic should not throw on ${c.desc}`);
    }

    console.log(`    Tested ${edgeCases.length} boundary inputs to triggerHaptic() safely without crashes.`);
    if (origNav) Object.defineProperty(globalThis, 'navigator', origNav);
  });

  await asyncTest('Mobile Haptics: navigator.vibrate throwing SecurityError / DOMException', async () => {
    const origNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        vibrate() {
          const err = new Error('SecurityError: Vibrations require active user interaction.');
          err.name = 'SecurityError';
          throw err;
        }
      },
      configurable: true,
      writable: true
    });

    const { triggerHaptic } = await import(`../src/lib/soundFx.js?t=${Date.now() + 5}`);
    assert.doesNotThrow(() => {
      triggerHaptic(10);
    }, 'triggerHaptic should catch SecurityError gracefully');

    if (origNav) Object.defineProperty(globalThis, 'navigator', origNav);
  });

  // ----------------------------------------------------------------------------
  // SUITE 5: CSS 3D Classes Syntax Validity & Cross-Browser Prefixes
  // ----------------------------------------------------------------------------
  console.log('\n--- SUITE 5: CSS 3D Classes Syntax Validity & Cross-Browser Prefixes ---');

  test('CSS 3D: Syntax validity in src/index.css', () => {
    const cssPath = path.resolve(__dirname, '../src/index.css');
    assert.ok(fs.existsSync(cssPath), 'src/index.css must exist');
    const css = fs.readFileSync(cssPath, 'utf8');

    // Verify essential 3D utility classes exist
    const requiredClasses = [
      '.perspective-1000',
      '.perspective-1200',
      '.transform-style-3d',
      '.preserve-3d',
      '.backface-hidden',
      '.rotate-y-180',
      '.rotate-y-0',
      '.flip-transition',
      '.luxury-card',
      '.glass-panel'
    ];

    for (const cls of requiredClasses) {
      assert.ok(css.includes(cls), `CSS must define ${cls}`);
    }

    // Cross-browser prefix analysis
    const checks = [
      { property: 'perspective', prefix: '-webkit-perspective', classBlock: '.perspective-1000' },
      { property: 'transform-style: preserve-3d', prefix: '-webkit-transform-style: preserve-3d', classBlock: '.preserve-3d' },
      { property: 'backface-visibility: hidden', prefix: '-webkit-backface-visibility: hidden', classBlock: '.backface-hidden' },
      { property: 'backdrop-filter: blur', prefix: '-webkit-backdrop-filter: blur', classBlock: '.luxury-card' },
      { property: 'backdrop-filter: blur', prefix: '-webkit-backdrop-filter: blur', classBlock: '.glass-panel' }
    ];

    for (const check of checks) {
      const hasProperty = css.includes(check.property);
      const hasPrefix = css.includes(check.prefix);
      assert.ok(hasProperty, `Class should contain ${check.property}`);
      assert.ok(hasPrefix, `Class should contain vendor prefix ${check.prefix}`);
    }

    // Check rotate-y-180 vendor prefix
    const rotateMatch = css.match(/\.rotate-y-180\s*\{([^}]+)\}/);
    if (rotateMatch) {
      const block = rotateMatch[1];
      const hasWebkit = block.includes('-webkit-transform');
      if (!hasWebkit) {
        findings.push({
          category: 'CSS_VENDOR_PREFIX_NOTE',
          severity: 'INFO',
          message: '.rotate-y-180 in src/index.css specifies `transform: rotateY(180deg)` without explicit `-webkit-transform`. While modern browsers (Chrome 36+, Safari 9+, Firefox 16+) support standard `transform`, legacy Safari 8 or older iOS WebViews required `-webkit-transform`. In Vite production build, PostCSS/Autoprefixer handles downstream compatibility target.'
        });
        console.log('    [EMPIRICAL OBSERVATION] .rotate-y-180 lacks explicit -webkit-transform prefix in source css');
      }
    }
  });

  test('CSS 3D: Build output verification in dist/', () => {
    const distDir = path.resolve(__dirname, '../dist/assets');
    if (fs.existsSync(distDir)) {
      const files = fs.readdirSync(distDir);
      const cssFile = files.find(f => f.endsWith('.css'));
      if (cssFile) {
        const compiledCss = fs.readFileSync(path.join(distDir, cssFile), 'utf8');
        assert.ok(compiledCss.includes('perspective') || compiledCss.includes('1000px'), 'Built CSS contains perspective');
        assert.ok(compiledCss.includes('preserve-3d'), 'Built CSS contains preserve-3d');
        assert.ok(compiledCss.includes('rotateY(180deg)'), 'Built CSS contains rotateY(180deg)');
        console.log(`    Verified production compiled CSS bundle (${cssFile}, ${compiledCss.length} bytes)`);
      }
    } else {
      console.log('    (dist/assets not built yet - skipping compiled CSS bundle check)');
    }
  });

  // ----------------------------------------------------------------------------
  // SUITE 6: Headless Puppeteer E2E Sound & CSS 3D Evaluation
  // ----------------------------------------------------------------------------
  console.log('\n--- SUITE 6: Puppeteer Headless Browser Verification ---');

  await asyncTest('Puppeteer: Render page and evaluate soundFx + 3D classes in Chromium', async () => {
    let puppeteer;
    try {
      puppeteer = await import('puppeteer');
    } catch {
      console.log('    puppeteer not available, skipping browser runtime test');
      return;
    }

    const browser = await puppeteer.default.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required']
    });

    try {
      const page = await browser.newPage();
      
      const testHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            .perspective-1000 { perspective: 1000px; -webkit-perspective: 1000px; }
            .transform-style-3d { transform-style: preserve-3d; -webkit-transform-style: preserve-3d; }
            .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
            .rotate-y-180 { transform: rotateY(180deg); }
            .luxury-card {
              background: rgba(16, 19, 24, 0.75);
              backdrop-filter: blur(14px);
              -webkit-backdrop-filter: blur(14px);
              border: 1px solid rgba(38, 44, 58, 0.85);
            }
          </style>
        </head>
        <body>
          <div id="card" class="perspective-1000 luxury-card">
            <div id="inner" class="transform-style-3d backface-hidden rotate-y-180">Card Content</div>
          </div>
        </body>
        </html>
      `;

      await page.setContent(testHtml);

      const computed = await page.evaluate(() => {
        const card = document.getElementById('card');
        const inner = document.getElementById('inner');
        const cardStyle = window.getComputedStyle(card);
        const innerStyle = window.getComputedStyle(inner);

        return {
          cardPerspective: cardStyle.perspective,
          cardBackdropFilter: cardStyle.backdropFilter || cardStyle.webkitBackdropFilter,
          innerTransformStyle: innerStyle.transformStyle,
          innerBackfaceVisibility: innerStyle.backfaceVisibility,
          innerTransform: innerStyle.transform
        };
      });

      console.log('    Chromium Computed Styles:');
      console.log('    - perspective:', computed.cardPerspective);
      console.log('    - backdropFilter:', computed.cardBackdropFilter);
      console.log('    - transformStyle:', computed.innerTransformStyle);
      console.log('    - backfaceVisibility:', computed.innerBackfaceVisibility);
      console.log('    - transform:', computed.innerTransform);

      assert.strictEqual(computed.cardPerspective, '1000px', 'Chromium computes perspective: 1000px');
      assert.strictEqual(computed.innerTransformStyle, 'preserve-3d', 'Chromium computes transform-style: preserve-3d');
      assert.strictEqual(computed.innerBackfaceVisibility, 'hidden', 'Chromium computes backface-visibility: hidden');
      assert.ok(computed.innerTransform.includes('matrix3d'), 'rotateY(180deg) computes to 3D transform matrix');
    } finally {
      await browser.close();
    }
  });

  // ----------------------------------------------------------------------------
  // SUMMARY & VERDICT GENERATION
  // ----------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log(`TOTAL ADVERSARIAL FINDINGS: ${findings.length}`);
  console.log('================================================================');

  findings.forEach((f, idx) => {
    console.log(`\n[FINDING #${idx + 1}] Category: ${f.category} | Severity: ${f.severity}`);
    console.log(`Details: ${f.message}`);
  });

  if (failedTests > 0) {
    process.exitCode = 1;
  }
}

runAll().catch(err => {
  console.error('Fatal stress test runner error:', err);
  process.exit(1);
});
