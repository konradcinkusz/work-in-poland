import { describe, expect, it } from 'vitest';
import { loginUrl, safeRedirect } from './redirect';

describe('safeRedirect', () => {
  it('keeps same-origin paths with query', () => {
    expect(safeRedirect('/konto?x=1')).toBe('/konto?x=1');
  });
  it('rejects absolute, protocol-relative, backslash and control characters', () => {
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/a\nb', '', null, undefined]) {
      expect(safeRedirect(bad as string | null)).toBe('/konto');
    }
  });
  it('builds the login URL with the encoded target', () => {
    expect(loginUrl('/konto')).toBe('/logowanie?redirect=%2Fkonto');
  });
});
