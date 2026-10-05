const WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7];

/** Polish NIP: 10 digits, weighted checksum mod 11 (a remainder of 10 is never valid). Mirrors the API rule. */
export function isValidNip(input: string): boolean {
  const nip = input.replace(/[\s-]/g, '');
  if (!/^\d{10}$/.test(nip)) return false;
  const sum = WEIGHTS.reduce((acc, w, i) => acc + w * Number(nip[i]), 0);
  const check = sum % 11;
  return check !== 10 && check === Number(nip[9]);
}
