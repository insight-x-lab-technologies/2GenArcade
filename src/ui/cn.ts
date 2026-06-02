/** Tiny class-name joiner (no dependency on clsx). */
export const cn = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');
