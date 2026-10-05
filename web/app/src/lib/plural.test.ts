import { describe, expect, it } from 'vitest';
import { plural } from './plural';

describe('plural', () => {
  it('uses one form for 1', () => {
    expect(plural(1, ['oferta', 'oferty', 'ofert'])).toBe('oferta');
  });
  it('uses few form for 2-4', () => {
    expect(plural(2, ['oferta', 'oferty', 'ofert'])).toBe('oferty');
    expect(plural(3, ['oferta', 'oferty', 'ofert'])).toBe('oferty');
    expect(plural(4, ['oferta', 'oferty', 'ofert'])).toBe('oferty');
  });
  it('uses many form for 5-21', () => {
    expect(plural(5, ['oferta', 'oferty', 'ofert'])).toBe('ofert');
    expect(plural(21, ['oferta', 'oferty', 'ofert'])).toBe('ofert');
  });
  it('uses few form for 22-24', () => {
    expect(plural(22, ['oferta', 'oferty', 'ofert'])).toBe('oferty');
    expect(plural(23, ['oferta', 'oferty', 'ofert'])).toBe('oferty');
    expect(plural(24, ['oferta', 'oferty', 'ofert'])).toBe('oferty');
  });
  it('uses many form for 25+', () => {
    expect(plural(25, ['oferta', 'oferty', 'ofert'])).toBe('ofert');
    expect(plural(100, ['oferta', 'oferty', 'ofert'])).toBe('ofert');
    expect(plural(112, ['oferta', 'oferty', 'ofert'])).toBe('ofert');
  });
});
