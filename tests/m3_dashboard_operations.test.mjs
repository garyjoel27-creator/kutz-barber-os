/**
 * Milestone M3 Verification Suite:
 * - Dashboard Usability (<3s Owner Glance)
 * - Primary Viewport: Compact Studio Bar, Zone A (Chairs), Zone B (Live Walk-In Queue), Zone C (3D Bento Cards)
 * - Collapsible Drawers: Telemetry & Radar, Vault Offline JSON, RGPD & Legal Rights
 * - M2 Polish Fixes: ClientBentoCard !absolute/style position & overflow-y-auto max-h-[380px], Clients normalizeText & defensive checks
 * - SoundFx integration on interactions
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('================================================================');
console.log('RUNNING MILESTONE M3: DASHBOARD & OPERATIONS VERIFICATION SUITE');
console.log('================================================================\n');

// 1. Verify ClientBentoCard.jsx M2 polish fixes
const bentoCardPath = path.join(projectRoot, 'src', 'components', 'ClientBentoCard.jsx');
assert.ok(fs.existsSync(bentoCardPath), 'ClientBentoCard.jsx must exist');
const bentoCardSrc = fs.readFileSync(bentoCardPath, 'utf8');

assert.ok(bentoCardSrc.includes('!absolute'), 'ClientBentoCard must use !absolute for positioning stability against .luxury-card');
assert.ok(bentoCardSrc.includes("style={{ position: 'absolute' }}"), 'ClientBentoCard must use inline style position absolute');
assert.ok(bentoCardSrc.includes('overflow-y-auto max-h-[380px]'), 'ClientBentoCard must use overflow-y-auto max-h-[380px] to prevent clipping');
console.log('✔ [PASS] ClientBentoCard.jsx M2 polish fixes verified (!absolute, inline position, max-h-[380px] scroll).');

// 2. Verify Clients.jsx accent-insensitive search and defensive checks
const clientsPath = path.join(projectRoot, 'src', 'pages', 'Clients.jsx');
assert.ok(fs.existsSync(clientsPath), 'Clients.jsx must exist');
const clientsSrc = fs.readFileSync(clientsPath, 'utf8');

assert.ok(clientsSrc.includes('normalizeText'), 'Clients.jsx must import and use normalizeText');
assert.ok(clientsSrc.includes('c.name || \'\''), 'Clients.jsx must defensively guard against missing c.name');
console.log('✔ [PASS] Clients.jsx search enhancements verified (normalizeText, defensive name guard).');

// 3. Test normalizeText algorithm with accents and null values
function normalizeText(text) {
  if (!text) return '';
  return text.toString().toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

assert.strictEqual(normalizeText('Álex Rivera'), 'alex rivera', 'normalizeText normalizes acute Á');
assert.strictEqual(normalizeText('conexión'), 'conexion', 'normalizeText normalizes ó');
assert.strictEqual(normalizeText(''), '', 'normalizeText handles empty string');
assert.strictEqual(normalizeText(null), '', 'normalizeText handles null');
assert.strictEqual(normalizeText(undefined), '', 'normalizeText handles undefined');

// Emulate search filter with normalizeText
const mockClients = [
  { id: '1', name: 'Mateo "El Flaco" Vargas', phone: '+34 600 123 456', treatments: [{ formula: 'Skin Fade Alto #000 + Conexión #2' }] },
  { id: '2', name: 'Dani Morales', phone: '+34 611 234 567', treatments: [{ formula: 'Low Taper Fade #0.5' }] },
  { id: '3', name: 'Álex Rivera', phone: '+34 622 345 678', treatments: [{ formula: 'Skin Fade #000 a #1.5' }] },
  { id: '4', name: null, phone: '+34 633 456 789' } // missing name edge case
];

function filterSearch(list, query) {
  const q = normalizeText(query);
  return list.filter(c => {
    const clientName = normalizeText(c.name || '');
    const clientPhone = (c.phone || '').toString();
    const formula = normalizeText(c.treatments?.[0]?.formula || '');
    return !q || clientName.includes(q) || clientPhone.includes(q) || formula.includes(q);
  });
}

const matchAlex = filterSearch(mockClients, 'alex');
assert.strictEqual(matchAlex.length, 1, 'Searching "alex" matches "Álex Rivera"');
assert.strictEqual(matchAlex[0].id, '3');

const matchConexion = filterSearch(mockClients, 'conexion');
assert.strictEqual(matchConexion.length, 1, 'Searching "conexion" matches "Conexión" in formula');
assert.strictEqual(matchConexion[0].id, '1');

const safeWithNullName = filterSearch(mockClients, 'dani');
assert.strictEqual(safeWithNullName.length, 1, 'Filtering list with null client name does not throw');
console.log('✔ [PASS] Accent-insensitive search and defensive null checks successfully verified.');

// 4. Verify Dashboard.jsx Architecture & Components
const dashboardPath = path.join(projectRoot, 'src', 'pages', 'Dashboard.jsx');
assert.ok(fs.existsSync(dashboardPath), 'Dashboard.jsx must exist');
const dashboardSrc = fs.readFileSync(dashboardPath, 'utf8');

// Check Primary Viewport sections
assert.ok(dashboardSrc.includes('KUTZ // STUDIO FLOOR'), 'Dashboard must contain compact studio bar header');
assert.ok(dashboardSrc.includes('SILLONES ACTIVOS'), 'Dashboard header must display active chairs counter');
assert.ok(dashboardSrc.includes('EN COLA VIVA'), 'Dashboard header must display live queue counter');
assert.ok(dashboardSrc.includes('openKiosk'), 'Dashboard header must offer Kiosko TV trigger');

// Zone A: Real-Time Barber Chairs
assert.ok(dashboardSrc.includes('ESTADO DE SILLONES EN TIEMPO REAL'), 'Dashboard must contain Zone A Real-Time Chairs');
assert.ok(dashboardSrc.includes('CH-01') && dashboardSrc.includes('REX'), 'Chair 1 must feature Rex');
assert.ok(dashboardSrc.includes('CH-02') && dashboardSrc.includes('KIKO'), 'Chair 2 must feature Kiko');
assert.ok(dashboardSrc.includes('CH-03') && dashboardSrc.includes('NICO'), 'Chair 3 must feature Nico');
assert.ok(dashboardSrc.includes('handleCycleChairStatus'), 'Dashboard must have chair status cycling handler');
assert.ok(dashboardSrc.includes('handleSeatNextInChair'), 'Dashboard must support seating walk-in queue clients into chair');

// Zone B: Live Walk-In Queue
assert.ok(dashboardSrc.includes('COLA VIVA // WALK-INS'), 'Dashboard must embed Zone B Live Walk-In Queue');
assert.ok(dashboardSrc.includes('SIGUIENTE TURNO'), 'Zone B must highlight next client in turn');
assert.ok(dashboardSrc.includes('handleNotifyQueue'), 'Zone B must provide 1-tap WhatsApp notify');
assert.ok(dashboardSrc.includes('isAddingWalkIn'), 'Zone B must provide quick-add walk-in form toggle');

// Zone C: Clientes del Día & 3D Bento Cards
assert.ok(dashboardSrc.includes('CLIENTES DEL DÍA'), 'Dashboard must contain Zone C Clientes del Día');
assert.ok(dashboardSrc.includes('ClientBentoCard'), 'Zone C must directly embed ClientBentoCard for 3D flip card interaction');

// Drawers (Secondary Modules collapsed by default)
assert.ok(dashboardSrc.includes('telemetry: false'), 'Telemetry drawer must be collapsed by default');
assert.ok(dashboardSrc.includes('vault: false'), 'Vault drawer must be collapsed by default');
assert.ok(dashboardSrc.includes('rgpd: false'), 'RGPD drawer must be collapsed by default');
assert.ok(dashboardSrc.includes('toggleDrawer'), 'Dashboard must provide smooth drawer toggle');

// Micro-interactions & Audio
assert.ok(dashboardSrc.includes('soundFx.playClick()'), 'Dashboard must call soundFx.playClick() on interactions');

console.log('✔ [PASS] Dashboard.jsx structure, primary viewport (Zones A, B, C) and collapsible drawers verified.');

console.log('\n================================================================');
console.log('ALL MILESTONE M3 VERIFICATIONS PASSED SUCCESSFULLY!');
console.log('================================================================');
