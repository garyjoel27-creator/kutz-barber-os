/**
 * Unit verification for soundFx.js procedural Web Audio API engine & haptics.
 */
import assert from 'node:assert';
import { soundFx, playFlip, playClick, triggerHaptic } from '../src/lib/soundFx.js';

console.log('Testing soundFx.js procedural Web Audio API synthesis engine...');

// 1. In Node.js / SSR environment, functions should execute safely without crashing
assert.doesNotThrow(() => {
  soundFx.init();
  playFlip();
  playClick();
  triggerHaptic(10);
}, 'soundFx functions should safely handle SSR / undefined window environment');

// 2. Simulated Web Audio API environment
class MockAudioParam {
  constructor(initialValue) {
    this.value = initialValue;
    this.ramps = [];
  }
  setValueAtTime(val, time) {
    this.value = val;
    this.ramps.push({ type: 'setValueAtTime', val, time });
  }
  exponentialRampToValueAtTime(val, time) {
    this.value = val;
    this.ramps.push({ type: 'exponentialRampToValueAtTime', val, time });
  }
  linearRampToValueAtTime(val, time) {
    this.value = val;
    this.ramps.push({ type: 'linearRampToValueAtTime', val, time });
  }
}

class MockOscillator {
  constructor() {
    this.type = 'sine';
    this.frequency = new MockAudioParam(440);
    this.started = false;
    this.stopped = false;
  }
  connect(dest) {
    this.destination = dest;
  }
  start(time) {
    this.started = true;
    this.startTime = time;
  }
  stop(time) {
    this.stopped = true;
    this.stopTime = time;
  }
}

class MockGain {
  constructor() {
    this.gain = new MockAudioParam(1);
  }
  connect(dest) {
    this.destination = dest;
  }
}

class MockBiquadFilter {
  constructor() {
    this.type = 'lowpass';
    this.frequency = new MockAudioParam(1000);
  }
  connect(dest) {
    this.destination = dest;
  }
}

let vibrateCalls = [];
if (typeof navigator !== 'undefined') {
  navigator.vibrate = function(duration) {
    vibrateCalls.push(duration);
    return true;
  };
} else {
  Object.defineProperty(global, 'navigator', {
    value: {
      vibrate(duration) {
        vibrateCalls.push(duration);
        return true;
      }
    },
    writable: true,
    configurable: true
  });
}

let createdOscillators = [];
let createdGains = [];
let createdFilters = [];

class MockAudioContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 100.0;
    this.destination = {};
  }
  createOscillator() {
    const osc = new MockOscillator();
    createdOscillators.push(osc);
    return osc;
  }
  createGain() {
    const gain = new MockGain();
    createdGains.push(gain);
    return gain;
  }
  createBiquadFilter() {
    const filter = new MockBiquadFilter();
    createdFilters.push(filter);
    return filter;
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

global.window = {
  AudioContext: MockAudioContext
};

// Reset soundFx instance to use mock
soundFx.ctx = null;
soundFx.init();
assert.ok(soundFx.ctx instanceof MockAudioContext, 'soundFx should initialize AudioContext');

// 3. Test playFlip() synthesis
createdOscillators = [];
createdGains = [];
createdFilters = [];
vibrateCalls = [];

playFlip();

assert.strictEqual(createdOscillators.length, 2, 'playFlip should create 2 oscillators (sine + triangle)');
assert.strictEqual(createdOscillators[0].type, 'sine', 'first oscillator should be sine');
assert.strictEqual(createdOscillators[1].type, 'triangle', 'second oscillator should be triangle');

// Check frequency ramps (180Hz -> 320Hz)
assert.strictEqual(createdOscillators[0].frequency.ramps[0].val, 180, 'frequency start should be 180Hz');
assert.strictEqual(createdOscillators[0].frequency.ramps[1].val, 320, 'frequency end should be 320Hz');

// Check duration (120ms)
assert.ok(Math.abs((createdOscillators[0].stopTime - createdOscillators[0].startTime) - 0.12) < 0.001, 'flip duration should be 120ms');

// Check gain decay
assert.strictEqual(createdGains[0].gain.ramps[0].val, 0.08, 'gain should start with audible punch');
assert.strictEqual(createdGains[0].gain.ramps[1].val, 0.001, 'gain should decay exponentially');

// Check haptic feedback
assert.ok(vibrateCalls.length > 0 && vibrateCalls[0] === 12, 'playFlip should trigger haptic feedback of 12ms');

// 4. Test playClick() synthesis
createdOscillators = [];
createdGains = [];
vibrateCalls = [];

playClick();

assert.strictEqual(createdOscillators.length, 1, 'playClick should create 1 oscillator');
assert.strictEqual(createdOscillators[0].type, 'triangle', 'oscillator should be triangle');
assert.strictEqual(createdOscillators[0].frequency.ramps[0].val, 600, 'frequency start should be 600Hz');
assert.strictEqual(createdOscillators[0].frequency.ramps[1].val, 200, 'frequency end should be 200Hz');
assert.ok(Math.abs((createdOscillators[0].stopTime - createdOscillators[0].startTime) - 0.03) < 0.001, 'click duration should be 30ms');
assert.ok(vibrateCalls.length > 0 && vibrateCalls[0] === 8, 'playClick should trigger haptic feedback of 8ms');

// 5. Test triggerHaptic()
vibrateCalls = [];
triggerHaptic(25);
assert.strictEqual(vibrateCalls[0], 25, 'triggerHaptic should invoke navigator.vibrate with given duration');

console.log('✔ All soundFx.js verification assertions PASSED successfully!');
