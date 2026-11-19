/**
 * Milestone M2 Unit Verification Suite:
 * Tests ClientContext extensions (getFadeAlert, INITIAL_BARBER_CLIENTS, updateClient, quickAddSession),
 * soundFx closed-state mitigations, and Bento card interaction contracts.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('Running Milestone M2 Bento & State Verification Suite...');

// 1. Verify soundFx.js closed-state recovery and error resilience
import { soundFx } from '../src/lib/soundFx.js';

assert.doesNotThrow(() => {
  soundFx.init();
  soundFx.playFlip();
  soundFx.playClick();
  soundFx.triggerHaptic(10);
}, 'soundFx methods execute safely in Node environment without crashing');

// 2. Verify ClientContext.jsx source structure and exports
const clientContextPath = path.join(projectRoot, 'src', 'context', 'ClientContext.jsx');
assert.ok(fs.existsSync(clientContextPath), 'ClientContext.jsx must exist');
const clientContextSrc = fs.readFileSync(clientContextPath, 'utf8');

assert.ok(clientContextSrc.includes('export function getFadeAlert('), 'ClientContext.jsx must export getFadeAlert');
assert.ok(clientContextSrc.includes('export const INITIAL_BARBER_CLIENTS = ['), 'ClientContext.jsx must export INITIAL_BARBER_CLIENTS');
assert.ok(clientContextSrc.includes('const updateClient ='), 'ClientContext.jsx must define updateClient');
assert.ok(clientContextSrc.includes('const quickAddSession ='), 'ClientContext.jsx must define quickAddSession');
assert.ok(clientContextSrc.includes('updateClient,'), 'ClientContext.Provider must provide updateClient');
assert.ok(clientContextSrc.includes('quickAddSession,'), 'ClientContext.Provider must provide quickAddSession');
assert.ok(clientContextSrc.includes('getFadeAlert,'), 'ClientContext.Provider must provide getFadeAlert');

// Verify authentic Unsplash photos and guard formulas in INITIAL_BARBER_CLIENTS
assert.ok(clientContextSrc.includes('photo: \'https://images.unsplash.com/photo-1507003211169'), 'Client 1 must have authentic Unsplash photo');
assert.ok(clientContextSrc.includes('photo: \'https://images.unsplash.com/photo-1500648767791'), 'Client 2 must have authentic Unsplash photo');
assert.ok(clientContextSrc.includes('photo: \'https://images.unsplash.com/photo-1506794778202'), 'Client 3 must have authentic Unsplash photo');
assert.ok(clientContextSrc.includes('#000'), 'Formula must specify guard #000');
assert.ok(clientContextSrc.includes('#3'), 'Formula must specify guard #3');

// 3. Test getFadeAlert calculation boundaries using redesignContracts model
import { getFadeAlert, MOCK_BARBERSHOP_STATE } from './helpers/redesignContracts.mjs';

// Test null input
const nullAlert = getFadeAlert(null);
assert.strictEqual(nullAlert.alertLevel, 'normal');
assert.strictEqual(nullAlert.requiresRetouch, false);

// Test empty treatments
const emptyAlert = getFadeAlert({ id: 'e1', name: 'Empty', treatments: [] });
assert.strictEqual(emptyAlert.alertLevel, 'normal');
assert.strictEqual(emptyAlert.label, 'Nuevo cliente');

// Test urgent alert (>= 21 days)
const refUrgent = new Date('2026-11-05T12:00:00Z');
const alexClient = MOCK_BARBERSHOP_STATE.vipClients[0];
const urgentAlert = getFadeAlert(alexClient, refUrgent);
assert.strictEqual(urgentAlert.alertLevel, 'urgent');
assert.strictEqual(urgentAlert.requiresRetouch, true);
assert.strictEqual(urgentAlert.daysRemaining, 0);
assert.ok(urgentAlert.elapsedDays >= 21);

// Test warning alert (15-20 days)
const refWarning = new Date('2026-10-27T12:00:00Z');
const warningAlert = getFadeAlert(alexClient, refWarning);
assert.strictEqual(warningAlert.alertLevel, 'warning');
assert.strictEqual(warningAlert.requiresRetouch, true);
assert.strictEqual(warningAlert.daysRemaining, 4);

// Test normal alert (< 15 days)
const refNormal = new Date('2026-10-15T12:00:00Z');
const normalAlert = getFadeAlert(alexClient, refNormal);
assert.strictEqual(normalAlert.alertLevel, 'normal');
assert.strictEqual(normalAlert.requiresRetouch, false);
assert.strictEqual(normalAlert.daysRemaining, 10);

// 4. Verify ClientBentoCard.jsx source file structure & 3D classes
const bentoCardPath = path.join(projectRoot, 'src', 'components', 'ClientBentoCard.jsx');
assert.ok(fs.existsSync(bentoCardPath), 'ClientBentoCard.jsx must exist');
const bentoCardSrc = fs.readFileSync(bentoCardPath, 'utf8');

assert.ok(bentoCardSrc.includes('perspective-1000'), 'ClientBentoCard must contain perspective-1000');
assert.ok(bentoCardSrc.includes('transform-style-3d'), 'ClientBentoCard must contain transform-style-3d');
assert.ok(bentoCardSrc.includes('backface-hidden'), 'ClientBentoCard must contain backface-hidden');
assert.ok(bentoCardSrc.includes('rotate-y-180'), 'ClientBentoCard must contain rotate-y-180');
assert.ok(bentoCardSrc.includes('stopPropagation'), 'ClientBentoCard must isolate click events with stopPropagation');
assert.ok(bentoCardSrc.includes('handleSaveQuickSession'), 'ClientBentoCard must have inline quick session logger');
assert.ok(bentoCardSrc.includes('soundFx.playFlip()'), 'ClientBentoCard must trigger soundFx.playFlip on flip');
assert.ok(bentoCardSrc.includes('soundFx.triggerHaptic(12)'), 'ClientBentoCard must trigger 12ms haptics on flip');

// 5. Verify Clients.jsx Bento Grid layout structure
const clientsPagePath = path.join(projectRoot, 'src', 'pages', 'Clients.jsx');
const clientsPageSrc = fs.readFileSync(clientsPagePath, 'utf8');

assert.ok(clientsPageSrc.includes('ClientBentoCard'), 'Clients.jsx must import and use ClientBentoCard');
assert.ok(clientsPageSrc.includes('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'), 'Clients.jsx must use responsive Bento grid');
assert.ok(clientsPageSrc.includes('col-span-1 md:col-span-2'), 'Clients.jsx must highlight hero client with col-span-2');

console.log('✔ All Milestone M2 Bento & State verification assertions PASSED successfully!');
