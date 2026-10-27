# json-expect

Compare JSON against an expected document. Where a value cannot be known in advance, such as a generated id, a timestamp or a token, you write a **tag** like `"@uuid"` instead of the value. Tags are plain functions you register by pattern, the way Cucumber registers steps.

```ts
import { deepCompare } from 'json-expect';

deepCompare(response.body, {
  id: '@uuid',
  icao: 'EDDF',
  createdAt: '@date',
  terminals: [{ id: '@uuid', name: 'Terminal 1' }],
});
```

`deepCompare` returns nothing when the document matches, and throws a `DeepCompareError` that says where it doesn't:

```
@uuid does not match at $.terminals[0].id
  expected: "@uuid"
  actual:   "T1"
```

It has no runtime dependencies and does not depend on any test runner, so it works the same in Jest, Vitest, `node:test`, Mocha or Cucumber.

## Install

```sh
npm install --save-dev json-expect
```

## Comparison rules

- **Objects must have exactly the expected keys.** Key order does not matter. A missing or extra key fails and is named in the message: `keys differ: missing "icao"; unexpected "iata"`.
- **Arrays must have the same length and order.**
- **An array never matches an object**, and `null` never matches an object.
- **Other values are compared with `===`**, so `"1"` does not match `1`.
- **A string starting with `@` is a tag**, if a registered tag matches it. Otherwise it is compared as a plain string, and the failure says `no tag matches @…` to help you spot typos.
- **`@@` stands for a literal `@`**: `"@@any"` matches the string `"@any"`.

## Built-in tags

| Tag                            | Matches                                                                   |
| ------------------------------ | ------------------------------------------------------------------------- |
| `@any`                         | any value                                                                 |
| `@string`                      | any string                                                                |
| `@number`                      | any finite number                                                         |
| `@boolean`                     | `true` or `false`                                                         |
| `@array`                       | any array                                                                 |
| `@object`                      | any object that is neither an array nor `null`                            |
| `@uuid`                        | an RFC 9562 UUID of any version, including the nil and max UUIDs          |
| `@date`                        | an ISO 8601 date (`2026-10-27`) or date-time (`2026-10-27T10:15:00.000Z`) |
| `@matches('pattern', 'flags')` | a string matching the regular expression. The flags are optional          |

A built-in tag refuses arguments it does not take, so `@date('tomorrow')` fails instead of quietly passing as `@date`.

## Your own tags

Register a tag with `Tag(pattern, matcher)`. Call it from any file that is loaded before the comparison runs. With Cucumber, that is any file matched by your step-definition glob.

```ts
import { Tag } from 'json-expect';

Tag(
  'icao',
  (actual) => typeof actual === 'string' && /^[A-Z]{4}$/.test(actual),
);
```

### The matcher

A matcher receives the actual value, followed by the tag's arguments.

- **Returning `false` fails** the comparison.
- **Throwing fails it**, and the thrown message is included in the `DeepCompareError`, with the original error as its `cause`. This lets you use `expect()` inside a matcher.
- **Returning `true` or nothing passes.**
- **Anything else fails**, including a Promise: matchers must be synchronous.

```ts
Tag('positive', (actual) => {
  expect(actual).toBeGreaterThan(0);
});
```

### Name patterns

A string pattern is a tag name. It matches `@name`, and `@name(...)` with arguments. Arguments are literals separated by commas: single- or double-quoted strings, numbers, `true`, `false` and `null`.

```ts
Tag(
  'defaultLivery',
  (actual, operator: string) =>
    actual === `${operator} ${new Date().getFullYear()}`,
);
```

```json
{ "livery": "@defaultLivery('Lufthansa')" }
```

Inside a quoted string, a backslash escapes only the quote and the backslash itself. Every other backslash is kept, so `@matches('^\\d+$')` in a JSON file reaches the matcher as `^\d+$`.

### RegExp patterns

Use a RegExp for any tag that is not shaped like `@name(...)`. The RegExp must match the whole text after the `@`, and its capture groups are passed to the matcher as arguments.

```ts
Tag(/date\('within (\d+) minutes? from now'\)/, (actual, minutes) => {
  const age = Date.now() - new Date(String(actual)).getTime();
  return age >= 0 && age < Number(minutes) * 60_000;
});
```

```json
{ "createdAt": "@date('within 1 minute from now')" }
```

### Which tag wins

Tags are tried from the most recently registered to the oldest, and the first match wins. Because the built-in tags are registered first, your own tag can replace any of them.

## Separate instances

`Tag` and `deepCompare` share one default set of tags. `createDeepCompare()` returns an independent pair, which is useful for isolating tests, or for starting without the built-in tags:

```ts
import { createDeepCompare } from 'json-expect';

const { Tag, deepCompare } = createDeepCompare({ builtInTags: false });
```

To share a set of tags between projects, export a function that registers them, and call it with whichever `Tag` you use:

```ts
import type { DeepCompare } from 'json-expect';

export function geoTags(Tag: DeepCompare['Tag']): void {
  Tag(
    'latitude',
    (actual) => typeof actual === 'number' && Math.abs(actual) <= 90,
  );
  Tag(
    'longitude',
    (actual) => typeof actual === 'number' && Math.abs(actual) <= 180,
  );
}
```

## `DeepCompareError`

| Property   | Contains                                                         |
| ---------- | ---------------------------------------------------------------- |
| `path`     | where the comparison failed, e.g. `$.flights[3].captain.id`      |
| `expected` | the expected value at that path                                  |
| `actual`   | the actual value at that path                                    |
| `reason`   | the short reason, e.g. `values differ` or `@uuid does not match` |
| `cause`    | the error a matcher threw, if it threw one                       |

The message renders each value as JSON, cut off after 200 characters. The `expected` and `actual` properties always hold the full values.

## Development

Development runs in Docker, so nothing is installed on the host:

```sh
docker compose build
docker compose run --rm app npm test
docker compose run --rm app npm run typecheck
docker compose run --rm app npm run lint
docker compose run --rm app npm run build
```

## License

MIT, see [LICENSE](LICENSE).
