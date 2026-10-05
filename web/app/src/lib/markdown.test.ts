import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders basic markdown', () => {
    const html = renderMarkdown('# Tytuł\n\n- jeden\n- dwa\n\n**ważne**');
    expect(html).toContain('<h1>Tytuł</h1>');
    expect(html).toContain('<li>jeden</li>');
    expect(html).toContain('<strong>ważne</strong>');
  });
  it('escapes raw HTML instead of passing it through', () => {
    const html = renderMarkdown('<script>alert(1)</script><img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });
  it('refuses javascript: and data: links', () => {
    const html = renderMarkdown('[x](javascript:alert(1)) [y](data:text/html;base64,AAAA) [z](vbscript:x)');
    expect(html).not.toMatch(/href="(javascript|data|vbscript):/i);
  });
  it('drops images', () => {
    expect(renderMarkdown('![x](https://evil.example/p.png)')).not.toContain('<img');
  });
  it('hardens https links', () => {
    const html = renderMarkdown('[firma](https://example.com)');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer nofollow ugc"');
  });
});
