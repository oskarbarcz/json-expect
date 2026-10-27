import type { TagMatcher } from './tag-registry';

const UUID =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;

const ISO_DATE =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

export const builtInTags: ReadonlyArray<readonly [string, TagMatcher]> = [
  ['any', withoutArguments(() => true)],
  ['string', withoutArguments((actual) => typeof actual === 'string')],
  [
    'number',
    withoutArguments(
      (actual) => typeof actual === 'number' && Number.isFinite(actual),
    ),
  ],
  ['boolean', withoutArguments((actual) => typeof actual === 'boolean')],
  ['array', withoutArguments((actual) => Array.isArray(actual))],
  [
    'object',
    withoutArguments(
      (actual) =>
        typeof actual === 'object' && actual !== null && !Array.isArray(actual),
    ),
  ],
  [
    'uuid',
    withoutArguments(
      (actual) => typeof actual === 'string' && UUID.test(actual),
    ),
  ],
  [
    'date',
    withoutArguments(
      (actual) =>
        typeof actual === 'string' &&
        ISO_DATE.test(actual) &&
        !Number.isNaN(Date.parse(actual)),
    ),
  ],
  ['matches', matches],
];

function withoutArguments(check: (actual: unknown) => boolean): TagMatcher {
  return (actual, ...args) => {
    if (args.length > 0) {
      throw new TypeError('this tag takes no arguments');
    }

    return check(actual);
  };
}

function matches(
  actual: unknown,
  pattern?: unknown,
  flags?: unknown,
  ...rest: unknown[]
): boolean {
  if (
    typeof pattern !== 'string' ||
    (flags !== undefined && typeof flags !== 'string') ||
    rest.length > 0
  ) {
    throw new TypeError(
      "expects a pattern and optional flags, e.g. @matches('^[A-Z]{4}$', 'i')",
    );
  }

  return typeof actual === 'string' && new RegExp(pattern, flags).test(actual);
}
