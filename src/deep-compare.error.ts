const MAX_RENDERED_LENGTH = 200;

export class DeepCompareError extends Error {
  override readonly name = 'DeepCompareError';

  constructor(
    readonly path: string,
    readonly expected: unknown,
    readonly actual: unknown,
    readonly reason: string,
    options?: ErrorOptions,
  ) {
    super(
      [
        `${reason} at ${path}`,
        `  expected: ${render(expected)}`,
        `  actual:   ${render(actual)}`,
        ...describeCause(options?.cause),
      ].join('\n'),
      options,
    );
  }
}

export function render(value: unknown): string {
  let text: string;

  try {
    text = JSON.stringify(value) ?? String(value);
  } catch {
    text = String(value);
  }

  return text.length > MAX_RENDERED_LENGTH
    ? `${text.slice(0, MAX_RENDERED_LENGTH)}…`
    : text;
}

function describeCause(cause: unknown): string[] {
  if (cause === undefined) {
    return [];
  }

  const message = cause instanceof Error ? cause.message : String(cause);
  return ['', ...message.split('\n').map((line) => `  ${line}`)];
}
