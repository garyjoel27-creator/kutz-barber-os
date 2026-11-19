#!/usr/bin/env node

/**
 * KUTZ // BARBER OS — QR Booking Engine & Multi-Shop Platform Master E2E Suite
 * Standalone Opaque-Box E2E Runner & Master Registry
 *
 * Tier 1: Primary Feature Coverage (Features F01–F12, 60 tests)
 * Tier 2: Boundary & Corner Cases (Features F01–F12, 60 tests)
 * Tier 3: Cross-Feature Interactions (14 Pairwise System Tests)
 * Tier 4: Real-World Barbershop Workloads (7 End-to-End Scenarios)
 * Total: 141 Rigorous Executable Tests
 */

import { TestRunner } from './helpers/testHarness.mjs';
import { registerBookingTier1Tests } from './booking_tier1.mjs';
import { registerBookingTier2Tests } from './booking_tier2.mjs';
import { registerBookingTier3Tests } from './booking_tier3.mjs';
import { registerBookingTier4Tests } from './booking_tier4.mjs';

export function registerAllBookingEngineSuites(runner) {
  registerBookingTier1Tests(runner);
  registerBookingTier2Tests(runner);
  registerBookingTier3Tests(runner);
  registerBookingTier4Tests(runner);
}

export async function runBookingEngineE2ESuite() {
  const runner = new TestRunner('KUTZ // QR BOOKING ENGINE & MULTI-SHOP MASTER E2E SUITE');

  console.log('\x1b[36mInitializing QR Booking Engine & Multi-Shop E2E Test Suite (Tiers 1–4)...\x1b[0m');
  registerAllBookingEngineSuites(runner);

  const result = await runner.execute();

  if (!result.success) {
    console.error(`\x1b[31m[BOOKING ENGINE TEST SUITE FAILURE]\x1b[0m ${result.totalFailed} test(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log(`\x1b[32m[BOOKING ENGINE TEST SUITE SUCCESS]\x1b[0m All ${result.totalPassed} tests passed successfully across all 4 tiers!`);
    process.exitCode = 0;
  }

  return result;
}

// Standalone CLI execution guard
const isDirectRun = process.argv[1] && process.argv[1].endsWith('e2e_booking_engine.test.mjs');
if (isDirectRun) {
  runBookingEngineE2ESuite().catch(err => {
    console.error('Fatal booking engine test runner execution error:', err);
    process.exit(1);
  });
}
