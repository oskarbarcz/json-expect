import { parseTagCall, TAG_NAME } from './tag-call';

export type TagMatcher = (actual: unknown, ...args: any[]) => boolean | void;

export type TagPattern = string | RegExp;

type Registration =
  | { readonly name: string; readonly matcher: TagMatcher }
  | { readonly regexp: RegExp; readonly matcher: TagMatcher };

export type Resolution =
  | { readonly matcher: TagMatcher; readonly args: unknown[] }
  | { readonly problem: string };

export class TagRegistry {
  private readonly registrations: Registration[] = [];

  register(pattern: TagPattern, matcher: TagMatcher): void {
    if (typeof matcher !== 'function') {
      throw new TypeError(
        `The matcher of tag ${String(pattern)} must be a function`,
      );
    }

    this.registrations.push(
      pattern instanceof RegExp
        ? { regexp: anchor(pattern), matcher }
        : { name: toTagName(pattern), matcher },
    );
  }

  resolve(text: string): Resolution | undefined {
    const call = parseTagCall(text);

    for (let index = this.registrations.length - 1; index >= 0; index--) {
      const registration = this.registrations[index];

      if ('regexp' in registration) {
        const match = registration.regexp.exec(text);
        if (match) {
          return { matcher: registration.matcher, args: match.slice(1) };
        }
        continue;
      }

      if (call === undefined || call.name !== registration.name) {
        continue;
      }

      return call.args === undefined
        ? { problem: `cannot parse the arguments of @${text}` }
        : { matcher: registration.matcher, args: call.args };
    }

    return undefined;
  }
}

function anchor(pattern: RegExp): RegExp {
  return new RegExp(
    `^(?:${pattern.source})$`,
    pattern.flags.replace(/[gy]/g, ''),
  );
}

function toTagName(pattern: string): string {
  const name = pattern.startsWith('@') ? pattern.slice(1) : pattern;

  if (!TAG_NAME.test(name)) {
    throw new TypeError(
      `"${pattern}" is not a tag name; register anything other than @name or @name(...) with a RegExp`,
    );
  }

  return name;
}
