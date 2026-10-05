import MarkdownIt from 'markdown-it';

/**
 * Markdown for employer-written text (job and company descriptions). Raw HTML is DISABLED
 * (`html: false` escapes it), images are dropped (the CSP and the privacy stance do not want
 * employer-hosted tracking pixels), and links are limited to http(s)/mailto and marked
 * `rel="noopener noreferrer nofollow ugc"`. The result is safe to inject as HTML.
 */
const md = new MarkdownIt({ html: false, linkify: true, breaks: false, typographer: false });

const SAFE_LINK = /^(https?:|mailto:)/i;
md.validateLink = (url) => SAFE_LINK.test(url.trim());
md.disable(['image']);

const defaultLinkOpen =
  md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  if (token) {
    token.attrSet('rel', 'noopener noreferrer nofollow ugc');
    token.attrSet('target', '_blank');
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

export function renderMarkdown(source: string): string {
  return md.render(source ?? '');
}
