import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseTagCall } from './tag-call';

describe('parseTagCall', () => {
  it('reads a bare name as a call without arguments', () => {
    assert.deepEqual(parseTagCall('uuid'), { name: 'uuid', args: [] });
  });

  it('reads empty parentheses as a call without arguments', () => {
    assert.deepEqual(parseTagCall('uuid()'), { name: 'uuid', args: [] });
    assert.deepEqual(parseTagCall('uuid(  )'), { name: 'uuid', args: [] });
  });

  it('reads quoted strings, numbers, booleans and null', () => {
    assert.deepEqual(
      parseTagCall(`tag('one', "two", 3, -4.5, 6e2, true, false, null)`),
      { name: 'tag', args: ['one', 'two', 3, -4.5, 600, true, false, null] },
    );
  });

  it('unescapes the quote and the backslash inside a string', () => {
    assert.deepEqual(parseTagCall(`tag('it\\'s', "say \\"hi\\"", 'a\\\\b')`), {
      name: 'tag',
      args: [`it's`, 'say "hi"', 'a\\b'],
    });
  });

  it('keeps any other backslash, so regular expressions survive', () => {
    assert.deepEqual(parseTagCall(`matches('^\\d+$')`), {
      name: 'matches',
      args: ['^\\d+$'],
    });
  });

  it('keeps parentheses and commas inside strings', () => {
    assert.deepEqual(parseTagCall(`tag('a, (b)')`), {
      name: 'tag',
      args: ['a, (b)'],
    });
  });

  it('accepts dots, dashes and underscores in names', () => {
    assert.equal(parseTagCall('geo.point')?.name, 'geo.point');
    assert.equal(parseTagCall('jwt_access-token')?.name, 'jwt_access-token');
  });

  for (const [label, text] of [
    ['unquoted text', 'tag(within 1 minute)'],
    ['a trailing comma', `tag('a',)`],
    ['a missing comma', `tag('a' 'b')`],
    ['an unterminated string', `tag('a)`],
  ]) {
    it(`reports malformed arguments for ${label}`, () => {
      assert.deepEqual(parseTagCall(text), { name: 'tag', args: undefined });
    });
  }

  for (const [label, text] of [
    ['a name starting with a digit', '1tag'],
    ['an unclosed call', 'tag('],
    ['text after the call', `tag('a') more`],
    ['a space in the name', 'some tag'],
  ]) {
    it(`does not read ${label} as a call`, () => {
      assert.equal(parseTagCall(text), undefined);
    });
  }
});
