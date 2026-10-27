import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDeepCompare } from './deep-compare';
import { DeepCompareError } from './deep-compare.error';

const { deepCompare } = createDeepCompare();

const show = (value: unknown) =>
  typeof value === 'number' ? String(value) : JSON.stringify(value);

describe('built-in tags', () => {
  for (const [tag, actual] of [
    ['@any', 'text'],
    ['@any', null],
    ['@any', { nested: [1] }],
    ['@string', ''],
    ['@number', 0],
    ['@number', -1.5],
    ['@boolean', false],
    ['@array', []],
    ['@object', {}],
    ['@uuid', '0f8fad5b-d9cb-469f-a165-70867728950e'],
    ['@uuid', '0F8FAD5B-D9CB-469F-A165-70867728950E'],
    ['@uuid', '00000000-0000-0000-0000-000000000000'],
    ['@uuid', '01890a5d-ac96-774b-bcce-b302099a8057'],
    ['@date', '2026-10-27'],
    ['@date', '2026-10-27T10:15:00Z'],
    ['@date', '2026-10-27T10:15:00.123Z'],
    ['@date', '2026-10-27T10:15:00+02:00'],
    [`@matches('^[A-Z]{4}$')`, 'EDDF'],
    [`@matches('^[a-z]{4}$', 'i')`, 'EDDF'],
    [`@matches('^\\d+$')`, '2026'],
  ] as const) {
    it(`${tag} accepts ${show(actual)}`, () => {
      assert.doesNotThrow(() => deepCompare(actual, tag));
    });
  }

  for (const [tag, actual] of [
    ['@string', 1],
    ['@number', '1'],
    ['@number', Number.NaN],
    ['@number', Number.POSITIVE_INFINITY],
    ['@boolean', 'true'],
    ['@array', {}],
    ['@object', []],
    ['@object', null],
    ['@uuid', 'not-a-uuid'],
    ['@uuid', '0f8fad5b-d9cb-069f-a165-70867728950e'],
    ['@uuid', 42],
    ['@date', '27.10.2026'],
    ['@date', '2026-13-45T99:99:99Z'],
    ['@date', 1761560100000],
    [`@matches('^[A-Z]{4}$')`, 'EDDFX'],
    [`@matches('^[A-Z]{4}$')`, 1234],
  ] as const) {
    it(`${tag} rejects ${show(actual)}`, () => {
      assert.throws(() => deepCompare(actual, tag), DeepCompareError);
    });
  }

  for (const tag of ['@uuid()', '@any()']) {
    it(`treats ${tag} as the tag without arguments`, () => {
      assert.doesNotThrow(() =>
        deepCompare('0f8fad5b-d9cb-469f-a165-70867728950e', tag),
      );
    });
  }

  for (const tag of [
    `@uuid(4)`,
    `@date('within 1 minute from now')`,
    `@string('x')`,
  ]) {
    it(`refuses arguments it does not take in ${tag}`, () => {
      assert.throws(
        () => deepCompare('2026-10-27', tag),
        /this tag takes no arguments/,
      );
    });
  }

  for (const tag of [`@matches`, `@matches(1)`, `@matches('a', 'i', 'x')`]) {
    it(`refuses ${tag} without a pattern`, () => {
      assert.throws(
        () => deepCompare('a', tag),
        /expects a pattern and optional flags/,
      );
    });
  }
});
