import { describe, expect, it } from 'vitest';
import { filtersToApiQuery, filtersToQuery, parseFilters } from './filters';

describe('filters <-> URL', () => {
  it('round-trips a full filter set', () => {
    const f = parseFilters({ q: 'backend', city: 'Warszawa', workMode: 'remote', seniority: 'senior', category: 'backend', salaryMin: '20000', contractType: 'b2b', page: '3' });
    expect(f.page).toBe(3);
    const again = parseFilters(new URLSearchParams(filtersToQuery(f)));
    expect(again).toEqual(f);
  });
  it('drops invalid enum values, junk numbers and page < 2', () => {
    const f = parseFilters({ workMode: 'moon', seniority: 'god', salaryMin: '12abc', page: '-4', contractType: 'x' });
    expect(f).toMatchObject({ workMode: '', seniority: '', salaryMin: '', contractType: '', page: 1 });
    expect(filtersToQuery(f)).toBe('');
  });
  it('takes the first value of repeated params', () => {
    expect(parseFilters({ q: ['a', 'b'] }).q).toBe('a');
  });
  it('builds the API query with page and limit', () => {
    const q = new URLSearchParams(filtersToApiQuery(parseFilters({ q: 'go', salaryMin: '15000' }), 10));
    expect(q.get('q')).toBe('go');
    expect(q.get('salaryMin')).toBe('15000');
    expect(q.get('page')).toBe('1');
    expect(q.get('limit')).toBe('10');
  });
});
