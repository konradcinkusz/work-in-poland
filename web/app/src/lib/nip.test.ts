import { describe, expect, it } from 'vitest';
import { isValidNip } from './nip';

describe('isValidNip', () => {
  it('accepts valid NIPs (with separators)', () => {
    expect(isValidNip('5260250995')).toBe(true);
    expect(isValidNip('526-025-09-95')).toBe(true);
    expect(isValidNip('5252248481')).toBe(true);
  });
  it('rejects wrong checksum, length and non-digits', () => {
    expect(isValidNip('5260250996')).toBe(false);
    expect(isValidNip('526025099')).toBe(false);
    expect(isValidNip('52602509950')).toBe(false);
    expect(isValidNip('52602509AB')).toBe(false);
    expect(isValidNip('')).toBe(false);
  });
  it('rejects a checksum remainder of 10', () => {
    // 1234567890: weighted sum = 6+10+21+8+15+24+35+48+63 = 230 -> 230 % 11 = 10
    expect(isValidNip('1234567890')).toBe(false);
  });
});
