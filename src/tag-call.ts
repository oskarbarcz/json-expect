export type TagArgument = string | number | boolean | null;

export interface TagCall {
  readonly name: string;
  readonly args: TagArgument[] | undefined;
}

export const TAG_NAME = /^[A-Za-z_][\w.-]*$/;

const CALL = /^([A-Za-z_][\w.-]*)(?:\((.*)\))?$/s;

const ARGUMENT =
  /\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|(-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)|(true|false|null))\s*(,|$)/y;

export function parseTagCall(text: string): TagCall | undefined {
  const match = CALL.exec(text);
  if (!match) {
    return undefined;
  }

  const [, name, source] = match;
  return { name, args: source === undefined ? [] : parseArguments(source) };
}

function parseArguments(source: string): TagArgument[] | undefined {
  if (source.trim() === '') {
    return [];
  }

  const pattern = new RegExp(ARGUMENT);
  const args: TagArgument[] = [];
  let separator = ',';

  while (separator === ',') {
    const match = pattern.exec(source);
    if (!match) {
      return undefined;
    }

    args.push(toArgument(match));
    separator = match[5];
  }

  return args;
}

function toArgument([
  ,
  single,
  double,
  number,
  keyword,
]: RegExpExecArray): TagArgument {
  if (single !== undefined) {
    return single.replace(/\\(['\\])/g, '$1');
  }

  if (double !== undefined) {
    return double.replace(/\\(["\\])/g, '$1');
  }

  if (number !== undefined) {
    return Number(number);
  }

  return keyword === 'null' ? null : keyword === 'true';
}
