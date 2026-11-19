/**
 * Standalone Test Harness for LuminaDesk E2E & Contract Testing
 * Zero dependencies, pure ESM, fully compatible with Node 18, 20, 22+
 */

class AssertionError extends Error {
  constructor(message, actual, expected) {
    super(message);
    this.name = 'AssertionError';
    this.actual = actual;
    this.expected = expected;
  }
}

export function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new AssertionError(`Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`, actual, expected);
      }
    },
    toEqual(expected) {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b) {
        throw new AssertionError(`Expected ${a} to equal ${b}`, actual, expected);
      }
    },
    toBeGreaterThan(expected) {
      if (!(actual > expected)) {
        throw new AssertionError(`Expected ${actual} to be greater than ${expected}`, actual, expected);
      }
    },
    toBeGreaterThanOrEqual(expected) {
      if (!(actual >= expected)) {
        throw new AssertionError(`Expected ${actual} to be greater than or equal to ${expected}`, actual, expected);
      }
    },
    toBeLessThan(expected) {
      if (!(actual < expected)) {
        throw new AssertionError(`Expected ${actual} to be less than ${expected}`, actual, expected);
      }
    },
    toBeLessThanOrEqual(expected) {
      if (!(actual <= expected)) {
        throw new AssertionError(`Expected ${actual} to be less than or equal to ${expected}`, actual, expected);
      }
    },
    toContain(item) {
      if (typeof actual === 'string') {
        if (!actual.includes(item)) {
          throw new AssertionError(`Expected string "${actual}" to contain "${item}"`, actual, item);
        }
      } else if (Array.isArray(actual)) {
        if (!actual.includes(item) && !actual.some(x => JSON.stringify(x) === JSON.stringify(item))) {
          throw new AssertionError(`Expected array to contain item ${JSON.stringify(item)}`, actual, item);
        }
      } else {
        throw new AssertionError(`toContain target must be string or array`, actual, item);
      }
    },
    toMatch(regex) {
      if (!regex.test(String(actual))) {
        throw new AssertionError(`Expected "${actual}" to match regex ${regex}`, actual, regex);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new AssertionError(`Expected ${actual} to be truthy`, actual, true);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new AssertionError(`Expected ${actual} to be falsy`, actual, false);
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new AssertionError(`Expected ${actual} to be null`, actual, null);
      }
    },
    toBeDefined() {
      if (actual === undefined) {
        throw new AssertionError(`Expected value to be defined, got undefined`, actual, 'defined');
      }
    },
    toBeUndefined() {
      if (actual !== undefined) {
        throw new AssertionError(`Expected value to be undefined, got ${actual}`, actual, undefined);
      }
    },
    toHaveLength(expectedLen) {
      if (!actual || typeof actual.length !== 'number' || actual.length !== expectedLen) {
        const len = actual ? actual.length : undefined;
        throw new AssertionError(`Expected length to be ${expectedLen}, got ${len}`, len, expectedLen);
      }
    },
    toThrow(expectedErrorSnippet) {
      if (typeof actual !== 'function') {
        throw new AssertionError(`Expected target to be a function for toThrow check`);
      }
      let threw = false;
      let error = null;
      try {
        actual();
      } catch (e) {
        threw = true;
        error = e;
      }
      if (!threw) {
        throw new AssertionError(`Expected function to throw, but it executed without error`);
      }
      if (expectedErrorSnippet && !String(error?.message || error).includes(expectedErrorSnippet)) {
        throw new AssertionError(`Expected error message to contain "${expectedErrorSnippet}", got "${error?.message}"`);
      }
    }
  };
}

class TestSuite {
  constructor(name) {
    this.name = name;
    this.tests = [];
  }

  addTest(description, fn) {
    this.tests.push({ description, fn });
  }

  async run() {
    console.log(`\n  \x1b[1m\x1b[36m▪ ${this.name}\x1b[0m`);
    let passed = 0;
    let failed = 0;
    const failures = [];

    for (const test of this.tests) {
      const startTime = Date.now();
      try {
        await test.fn();
        const duration = Date.now() - startTime;
        console.log(`    \x1b[32m✔\x1b[0m \x1b[90m${test.description}\x1b[0m \x1b[33m(${duration}ms)\x1b[0m`);
        passed++;
      } catch (err) {
        const duration = Date.now() - startTime;
        console.log(`    \x1b[31m✖\x1b[0m \x1b[31m${test.description}\x1b[0m \x1b[33m(${duration}ms)\x1b[0m`);
        console.log(`      \x1b[31mError: ${err.message}\x1b[0m`);
        if (err.stack) {
          const stackLine = err.stack.split('\n')[1] || '';
          console.log(`      \x1b[90m${stackLine.trim()}\x1b[0m`);
        }
        failed++;
        failures.push({ description: test.description, error: err });
      }
    }

    return { name: this.name, total: this.tests.length, passed, failed, failures };
  }
}

export class TestRunner {
  constructor(runnerName = 'LuminaDesk E2E Suite') {
    this.runnerName = runnerName;
    this.suites = [];
    this.currentSuite = null;
  }

  describe(name, fn) {
    const suite = new TestSuite(name);
    this.suites.push(suite);
    this.currentSuite = suite;
    fn();
    this.currentSuite = null;
  }

  it(description, fn) {
    if (!this.currentSuite) {
      throw new Error('it() must be called inside a describe() block');
    }
    this.currentSuite.addTest(description, fn);
  }

  async execute() {
    console.log(`\n\x1b[1m\x1b[35m=======================================================================\x1b[0m`);
    console.log(`\x1b[1m\x1b[35m  ${this.runnerName.toUpperCase()}\x1b[0m`);
    console.log(`\x1b[1m\x1b[35m=======================================================================\x1b[0m`);

    const overallStart = Date.now();
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    const suiteResults = [];

    for (const suite of this.suites) {
      const result = await suite.run();
      suiteResults.push(result);
      totalTests += result.total;
      totalPassed += result.passed;
      totalFailed += result.failed;
    }

    const totalDuration = Date.now() - overallStart;

    console.log(`\n\x1b[1m\x1b[35m-----------------------------------------------------------------------\x1b[0m`);
    console.log(`\x1b[1mEXECUTION SUMMARY:\x1b[0m`);
    for (const res of suiteResults) {
      const statusColor = res.failed === 0 ? '\x1b[32m' : '\x1b[31m';
      console.log(`  ${statusColor}${res.failed === 0 ? 'PASS' : 'FAIL'}\x1b[0m - ${res.name}: ${res.passed}/${res.total} passed`);
    }
    console.log(`\x1b[1mTotal Tests:\x1b[0m ${totalTests} | \x1b[32mPassed:\x1b[0m ${totalPassed} | \x1b[31mFailed:\x1b[0m ${totalFailed}`);
    console.log(`\x1b[1mDuration:\x1b[0m ${totalDuration}ms`);
    console.log(`\x1b[1m\x1b[35m=======================================================================\x1b[0m\n`);

    return {
      success: totalFailed === 0,
      totalTests,
      totalPassed,
      totalFailed,
      duration: totalDuration,
      suites: suiteResults
    };
  }
}
