import { builtInTags } from './built-in-tags';
import { DeepCompareError, render } from './deep-compare.error';
import { type TagMatcher, type TagPattern, TagRegistry } from './tag-registry';

export interface DeepCompareOptions {
  readonly builtInTags?: boolean;
}

export interface DeepCompare {
  Tag(pattern: TagPattern, matcher: TagMatcher): void;
  deepCompare(actual: unknown, expected: unknown): void;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

export function createDeepCompare(
  options: DeepCompareOptions = {},
): DeepCompare {
  const registry = new TagRegistry();

  if (options.builtInTags !== false) {
    for (const [pattern, matcher] of builtInTags) {
      registry.register(pattern, matcher);
    }
  }

  return {
    Tag: (pattern, matcher) => registry.register(pattern, matcher),
    deepCompare: (actual, expected) => compare(registry, actual, expected, '$'),
  };
}

function compare(
  registry: TagRegistry,
  actual: unknown,
  expected: unknown,
  path: string,
): void {
  if (typeof expected === 'string' && expected.startsWith('@')) {
    compareTag(registry, actual, expected, path);
    return;
  }

  if (Array.isArray(expected)) {
    compareArray(registry, actual, expected, path);
    return;
  }

  if (typeof expected === 'object' && expected !== null) {
    compareObject(registry, actual, expected, path);
    return;
  }

  if (actual !== expected) {
    throw new DeepCompareError(path, expected, actual, 'values differ');
  }
}

function compareTag(
  registry: TagRegistry,
  actual: unknown,
  expected: string,
  path: string,
): void {
  if (expected.startsWith('@@')) {
    if (actual !== expected.slice(1)) {
      throw new DeepCompareError(path, expected, actual, 'values differ');
    }
    return;
  }

  const resolution = registry.resolve(expected.slice(1));

  if (resolution === undefined) {
    if (actual !== expected) {
      throw new DeepCompareError(
        path,
        expected,
        actual,
        `values differ (no tag matches ${expected})`,
      );
    }
    return;
  }

  if ('problem' in resolution) {
    throw new DeepCompareError(path, expected, actual, resolution.problem);
  }

  let verdict: unknown;

  try {
    verdict = resolution.matcher(actual, ...resolution.args);
  } catch (error) {
    throw new DeepCompareError(
      path,
      expected,
      actual,
      `${expected} does not match`,
      { cause: error },
    );
  }

  if (verdict === true || verdict === undefined) {
    return;
  }

  if (verdict === false) {
    throw new DeepCompareError(
      path,
      expected,
      actual,
      `${expected} does not match`,
    );
  }

  throw new DeepCompareError(
    path,
    expected,
    actual,
    isThenable(verdict)
      ? `${expected} returned a promise; tag matchers must be synchronous`
      : `${expected} returned ${render(verdict)}; tag matchers return true, false or nothing`,
  );
}

function compareArray(
  registry: TagRegistry,
  actual: unknown,
  expected: unknown[],
  path: string,
): void {
  if (!Array.isArray(actual)) {
    throw new DeepCompareError(
      path,
      expected,
      actual,
      `expected an array, got ${kindOf(actual)}`,
    );
  }

  if (actual.length !== expected.length) {
    throw new DeepCompareError(
      path,
      expected,
      actual,
      `expected ${expected.length} items, got ${actual.length}`,
    );
  }

  for (const [index, item] of expected.entries()) {
    compare(registry, actual[index], item, `${path}[${index}]`);
  }
}

function compareObject(
  registry: TagRegistry,
  actual: unknown,
  expected: object,
  path: string,
): void {
  if (kindOf(actual) !== 'object') {
    throw new DeepCompareError(
      path,
      expected,
      actual,
      `expected an object, got ${kindOf(actual)}`,
    );
  }

  const actualRecord = actual as Record<string, unknown>;
  const expectedRecord = expected as Record<string, unknown>;
  const missing = Object.keys(expectedRecord).filter(
    (key) => !Object.hasOwn(actualRecord, key),
  );
  const unexpected = Object.keys(actualRecord).filter(
    (key) => !Object.hasOwn(expectedRecord, key),
  );

  if (missing.length > 0 || unexpected.length > 0) {
    throw new DeepCompareError(
      path,
      expected,
      actual,
      describeKeyDifference(missing, unexpected),
    );
  }

  for (const key of Object.keys(expectedRecord)) {
    compare(
      registry,
      actualRecord[key],
      expectedRecord[key],
      childPath(path, key),
    );
  }
}

function describeKeyDifference(
  missing: string[],
  unexpected: string[],
): string {
  const quote = (keys: string[]) =>
    keys.map((key) => JSON.stringify(key)).join(', ');
  const parts = [
    ...(missing.length > 0 ? [`missing ${quote(missing)}`] : []),
    ...(unexpected.length > 0 ? [`unexpected ${quote(unexpected)}`] : []),
  ];

  return `keys differ: ${parts.join('; ')}`;
}

function childPath(path: string, key: string): string {
  return IDENTIFIER.test(key)
    ? `${path}.${key}`
    : `${path}[${JSON.stringify(key)}]`;
}

function kindOf(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  return Array.isArray(value) ? 'array' : typeof value;
}

function isThenable(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}
