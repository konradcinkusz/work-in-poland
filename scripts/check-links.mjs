#!/usr/bin/env node
// Every relative link in the repository's markdown resolves (INIT-GENERIC-TEMPLATE §10.7).
// A stale link is a stale README, and a stale README is a review finding (P14).
//
//   node scripts/check-links.mjs
//
// Checks `[text](relative/path)` and `[text](path#anchor)` against the filesystem and, for
// markdown targets, the anchor against the target's headings. External (http/https/mailto)
// links are not fetched: CI must not depend on the internet being kind.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const SKIP = new Set(['.git', 'node_modules', '.next', 'bin', 'obj', 'playwright-report', 'test-results', 'build']);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (name.endsWith('.md')) yield full;
  }
}

const slug = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');

function anchorsOf(file) {
  const out = new Set();
  const text = readFileSync(file, 'utf8');
  let fenced = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('```')) fenced = !fenced;
    if (fenced) continue;
    const m = /^#{1,6}\s+(.*)$/.exec(line);
    if (m) out.add(slug(m[1]));
    for (const a of line.matchAll(/<a\s+name="([^"]+)"/g)) out.add(a[1]);
  }
  return out;
}

let bad = 0;
for (const file of walk(root)) {
  const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
  for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = m[1];
    // Root-absolute links ("/cookies") are routes of the web app (legal pages), not files.
    if (target.startsWith('/')) continue;
    if (/^(https?:|mailto:|tel:|#?$)/.test(target)) {
      if (target.startsWith('#') && target.length > 1 && !anchorsOf(file).has(target.slice(1))) {
        console.error(`${relative(root, file)}: missing anchor ${target}`);
        bad++;
      }
      continue;
    }
    const [pathPart, anchor] = target.split('#');
    const resolved = resolve(dirname(file), decodeURIComponent(pathPart));
    if (!existsSync(resolved)) {
      console.error(`${relative(root, file)}: broken link ${target}`);
      bad++;
    } else if (anchor && resolved.endsWith('.md') && !anchorsOf(resolved).has(anchor)) {
      console.error(`${relative(root, file)}: ${pathPart} has no anchor #${anchor}`);
      bad++;
    }
  }
}

if (bad) {
  console.error(`\n${bad} broken link(s).`);
  process.exit(1);
}
console.log('All relative markdown links resolve.');
