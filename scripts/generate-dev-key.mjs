#!/usr/bin/env node
// Prints a fresh RSA-2048 signing key as PKCS#8 PEM ("BEGIN PRIVATE KEY") — the format
// authservice's Jwt:PrivateKeyPem / Jwt:PrivateKeyPath expects (PKCS#1 "BEGIN RSA PRIVATE KEY"
// is rejected by the importer with an error that names neither format).
//
// Why a script and not `openssl genpkey ...` in the README: openssl is not a command on a
// stock Windows PowerShell, and Node is already a prerequisite of this repository, so the one
// instruction works on every platform contributors use (IDENTITY-AND-ACCOUNTS §10).
//
//   node scripts/generate-dev-key.mjs              # PEM to stdout
//   node scripts/generate-dev-key.mjs --out FILE   # PEM to FILE (mode 0600), nothing on stdout
//
// A key generated here is a DEVELOPMENT key. It is never a production trust root: production
// keys are generated per deployment and set as Fly secrets (flyio/SECRETS.md).
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const outIndex = process.argv.indexOf('--out');
if (outIndex !== -1) {
  const file = process.argv[outIndex + 1];
  if (!file) {
    console.error('generate-dev-key: --out needs a file path');
    process.exit(2);
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, privateKey, { mode: 0o600 });
} else {
  process.stdout.write(privateKey);
}
