import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { createDeepCompare } from './deep-compare';
import { DeepCompareError } from './deep-compare.error';

function failureOf(run: () => void): DeepCompareError {
  try {
    run();
  } catch (error) {
    if (error instanceof DeepCompareError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected the comparison to fail');
}

describe('deepCompare', () => {
  describe('structure', () => {
    const { deepCompare } = createDeepCompare({ builtInTags: false });

    it('passes on equal documents', () => {
      assert.doesNotThrow(() =>
        deepCompare(
          { id: 1, name: 'EDDF', tags: ['a', 'b'], parent: null, ok: true },
          { id: 1, name: 'EDDF', tags: ['a', 'b'], parent: null, ok: true },
        ),
      );
    });

    it('ignores key order', () => {
      assert.doesNotThrow(() => deepCompare({ a: 1, b: 2 }, { b: 2, a: 1 }));
    });

    it('reports where a primitive differs', () => {
      const error = failureOf(() =>
        deepCompare(
          { flights: [{ captain: { id: 'rick' } }] },
          { flights: [{ captain: { id: 'morty' } }] },
        ),
      );

      assert.equal(error.path, '$.flights[0].captain.id');
      assert.equal(error.reason, 'values differ');
      assert.equal(error.expected, 'morty');
      assert.equal(error.actual, 'rick');
      assert.equal(
        error.message,
        [
          'values differ at $.flights[0].captain.id',
          '  expected: "morty"',
          '  actual:   "rick"',
        ].join('\n'),
      );
    });

    it('compares strictly, without type coercion', () => {
      assert.equal(
        failureOf(() => deepCompare({ id: '1' }, { id: 1 })).path,
        '$.id',
      );
    });

    it('quotes keys that are not identifiers', () => {
      assert.equal(
        failureOf(() =>
          deepCompare({ 'first name': [0, 1] }, { 'first name': [0, 2] }),
        ).path,
        '$["first name"][1]',
      );
    });

    it('names missing and unexpected keys', () => {
      const error = failureOf(() =>
        deepCompare(
          { airport: { iata: 'FRA', name: 'Frankfurt' } },
          { airport: { icao: 'EDDF', name: 'Frankfurt' } },
        ),
      );

      assert.equal(error.path, '$.airport');
      assert.equal(
        error.reason,
        'keys differ: missing "icao"; unexpected "iata"',
      );
    });

    it('treats a key holding undefined as present', () => {
      assert.equal(
        failureOf(() => deepCompare({ a: 1, b: undefined }, { a: 1 })).reason,
        'keys differ: unexpected "b"',
      );
    });

    it('does not take an array for an object or the other way round', () => {
      assert.equal(
        failureOf(() => deepCompare(['x'], { 0: 'x' })).reason,
        'expected an object, got array',
      );
      assert.equal(
        failureOf(() => deepCompare({ 0: 'x' }, ['x'])).reason,
        'expected an array, got object',
      );
    });

    it('requires arrays of the same length in the same order', () => {
      assert.equal(
        failureOf(() => deepCompare([1, 2, 3], [1, 2])).reason,
        'expected 2 items, got 3',
      );
      assert.equal(failureOf(() => deepCompare([2, 1], [1, 2])).path, '$[0]');
    });

    it('does not take null for an object', () => {
      assert.equal(
        failureOf(() => deepCompare(null, {})).reason,
        'expected an object, got null',
      );
      assert.equal(
        failureOf(() => deepCompare({}, null)).reason,
        'values differ',
      );
    });

    it('shortens long values in the message', () => {
      const error = failureOf(() =>
        deepCompare({ text: 'x'.repeat(500) }, { text: 'y' }),
      );

      assert.ok(error.message.includes(`"${'x'.repeat(199)}…`));
      assert.equal(error.actual, 'x'.repeat(500));
    });
  });

  describe('tags', () => {
    it('passes arguments of a named tag to its matcher', () => {
      const { Tag, deepCompare } = createDeepCompare();
      const livery = `Lufthansa ${new Date().getFullYear()}`;
      const matcher = mock.fn(
        (actual: unknown, operator: string) =>
          actual === `${operator} ${new Date().getFullYear()}`,
      );
      Tag('defaultLivery', matcher);

      assert.doesNotThrow(() =>
        deepCompare({ livery }, { livery: `@defaultLivery('Lufthansa')` }),
      );
      assert.deepEqual(matcher.mock.calls[0].arguments, [livery, 'Lufthansa']);
    });

    it('accepts a name registered with its @', () => {
      const { Tag, deepCompare } = createDeepCompare({ builtInTags: false });
      Tag('@icao', (actual) => /^[A-Z]{4}$/.test(String(actual)));

      assert.doesNotThrow(() => deepCompare('EDDF', '@icao'));
    });

    it('passes the captures of a RegExp tag to its matcher', () => {
      const { Tag, deepCompare } = createDeepCompare();
      Tag(/date\('within (\d+) minutes? from now'\)/, (actual, minutes) => {
        const age = Date.now() - new Date(String(actual)).getTime();
        return age >= 0 && age < Number(minutes) * 60_000;
      });

      const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString();
      const twoMinutesAgo = new Date(Date.now() - 120_000).toISOString();

      assert.doesNotThrow(() =>
        deepCompare(thirtySecondsAgo, `@date('within 1 minute from now')`),
      );
      assert.throws(
        () => deepCompare(twoMinutesAgo, `@date('within 1 minute from now')`),
        DeepCompareError,
      );
      assert.doesNotThrow(() => deepCompare(twoMinutesAgo, '@date'));
    });

    it('matches a RegExp against the whole tag only', () => {
      const { Tag, deepCompare } = createDeepCompare({ builtInTags: false });
      Tag(/id/, () => true);

      assert.equal(
        failureOf(() => deepCompare('x', '@valid')).reason,
        'values differ (no tag matches @valid)',
      );
      assert.doesNotThrow(() => deepCompare('x', '@id'));
    });

    it('lets the latest registration win, so built-ins can be replaced', () => {
      const { Tag, deepCompare } = createDeepCompare();
      Tag('uuid', (actual) => actual === 'my-own-id');

      assert.doesNotThrow(() => deepCompare('my-own-id', '@uuid'));
      assert.throws(
        () => deepCompare('0f8fad5b-d9cb-469f-a165-70867728950e', '@uuid'),
        DeepCompareError,
      );
    });

    it('reports a rejected value with the tag and the path', () => {
      const { deepCompare } = createDeepCompare();
      const error = failureOf(() =>
        deepCompare({ user: { id: 'rick' } }, { user: { id: '@uuid' } }),
      );

      assert.equal(
        error.message,
        [
          '@uuid does not match at $.user.id',
          '  expected: "@uuid"',
          '  actual:   "rick"',
        ].join('\n'),
      );
    });

    it('carries what a throwing matcher said', () => {
      const { Tag, deepCompare } = createDeepCompare();
      const problem = new Error('token type is refresh\nexpected access');
      Tag('jwt_access_token', () => {
        throw problem;
      });

      const error = failureOf(() =>
        deepCompare({ token: 'abc' }, { token: '@jwt_access_token' }),
      );

      assert.equal(error.cause, problem);
      assert.equal(
        error.message,
        [
          '@jwt_access_token does not match at $.token',
          '  expected: "@jwt_access_token"',
          '  actual:   "abc"',
          '',
          '  token type is refresh',
          '  expected access',
        ].join('\n'),
      );
    });

    it('works with assertions inside a matcher', () => {
      const { Tag, deepCompare } = createDeepCompare();
      Tag('positive', (actual) => {
        assert.ok(typeof actual === 'number' && actual > 0, 'not positive');
      });

      assert.doesNotThrow(() => deepCompare(1, '@positive'));
      assert.ok(
        failureOf(() => deepCompare(-1, '@positive')).message.includes(
          'not positive',
        ),
      );
    });

    it('refuses an asynchronous matcher instead of passing', () => {
      const { Tag, deepCompare } = createDeepCompare();
      Tag('later', (async () => false) as never);

      assert.equal(
        failureOf(() => deepCompare(1, '@later')).reason,
        '@later returned a promise; tag matchers must be synchronous',
      );
    });

    it('refuses a matcher that returns something other than a boolean', () => {
      const { Tag, deepCompare } = createDeepCompare();
      Tag('length', ((actual: string) => actual.length) as never);

      assert.equal(
        failureOf(() => deepCompare('', '@length')).reason,
        '@length returned 0; tag matchers return true, false or nothing',
      );
    });

    it('reports arguments it cannot parse for a known tag', () => {
      const { deepCompare } = createDeepCompare();

      assert.equal(
        failureOf(() => deepCompare('EDDF', '@matches(^EDDF$)')).reason,
        'cannot parse the arguments of @matches(^EDDF$)',
      );
    });

    it('compares an unknown tag as a literal and hints at it', () => {
      const { deepCompare } = createDeepCompare();

      assert.doesNotThrow(() => deepCompare('@handle', '@handle'));
      assert.equal(
        failureOf(() =>
          deepCompare('0f8fad5b-d9cb-469f-a165-70867728950e', '@uiud'),
        ).reason,
        'values differ (no tag matches @uiud)',
      );
    });

    it('reads @@ as a literal @', () => {
      const { deepCompare } = createDeepCompare();

      assert.doesNotThrow(() => deepCompare('@any', '@@any'));
      assert.equal(
        failureOf(() => deepCompare('anything', '@@any')).reason,
        'values differ',
      );
    });

    it('starts without built-in tags when asked', () => {
      const { deepCompare } = createDeepCompare({ builtInTags: false });

      assert.equal(
        failureOf(() => deepCompare('x', '@any')).reason,
        'values differ (no tag matches @any)',
      );
    });

    it('keeps the tags of separate instances apart', () => {
      const first = createDeepCompare({ builtInTags: false });
      const second = createDeepCompare({ builtInTags: false });
      first.Tag('mine', () => true);

      assert.doesNotThrow(() => first.deepCompare('x', '@mine'));
      assert.throws(() => second.deepCompare('x', '@mine'), DeepCompareError);
    });

    for (const pattern of [
      "defaultLivery('{string}')",
      'two words',
      '1st',
      '',
    ]) {
      it(`refuses to register ${JSON.stringify(pattern)} as a tag name`, () => {
        const { Tag } = createDeepCompare();

        assert.throws(() => Tag(pattern, () => true), TypeError);
      });
    }

    it('refuses a matcher that is not a function', () => {
      const { Tag } = createDeepCompare();

      assert.throws(() => Tag('broken', 'yes' as never), TypeError);
    });
  });
});
