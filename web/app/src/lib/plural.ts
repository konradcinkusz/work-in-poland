/** Polish pluralization: select form based on count. Rules: 1 → one, 2-4 → few, 5+ → many. */
export function plural(n: number, forms: [one: string, few: string, many: string]): string {
  if (n === 1) return forms[0];
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return forms[1];
  return forms[2];
}
