import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DeepCompareError, deepCompare, Tag } from './index';

describe('the default instance', () => {
  it('comes with the built-in tags', () => {
    assert.doesNotThrow(() =>
      deepCompare(
        { id: '0f8fad5b-d9cb-469f-a165-70867728950e', createdAt: 'whenever' },
        { id: '@uuid', createdAt: '@any' },
      ),
    );
  });

  it('uses the tags registered through the exported Tag', () => {
    Tag(
      'icao',
      (actual) => typeof actual === 'string' && /^[A-Z]{4}$/.test(actual),
    );

    assert.doesNotThrow(() => deepCompare({ code: 'EDDF' }, { code: '@icao' }));
    assert.throws(
      () => deepCompare({ code: 'FRA' }, { code: '@icao' }),
      DeepCompareError,
    );
  });
});
