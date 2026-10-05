#!/usr/bin/env node
/**
 * Verify that consent versions are synchronized across all four places:
 * 1. flyio/authservice.fly.toml (ConsentVersions__Terms|Privacy|Cookies)
 * 2. flyio/web.fly.toml (CONSENT_TERMS|PRIVACY|COOKIES_VERSION)
 * 3. tests/e2e/docker-compose.yml (authservice + web environments)
 *
 * A mismatch breaks user registration (authservice won't accept a version
 * the web app doesn't know about). This script is a CI gate.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const files = {
  authserviceToml: resolve(repoRoot, 'flyio/authservice.fly.toml'),
  webToml: resolve(repoRoot, 'flyio/web.fly.toml'),
  dockerCompose: resolve(repoRoot, 'tests/e2e/docker-compose.yml'),
};

/**
 * Extract value from TOML key = "value" syntax.
 */
function extractTomlValue(content, key) {
  const regex = new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"`, 'm');
  const match = content.match(regex);
  return match?.[1] || null;
}

/**
 * Extract environment variable value from YAML.
 * Handles both formats:
 *   KEY: VALUE
 *   KEY: "VALUE"
 */
function extractYamlEnvValue(content, key) {
  const regex = new RegExp(`^\\s*${key}:\\s*"?([^"\\n]+)"?`, 'm');
  const match = content.match(regex);
  return match?.[1] || null;
}

const authserviceTomL = readFileSync(files.authserviceToml, 'utf-8');
const webToml = readFileSync(files.webToml, 'utf-8');
const dockerCompose = readFileSync(files.dockerCompose, 'utf-8');

const versions = {
  'authservice:Terms': extractTomlValue(authserviceTomL, 'ConsentVersions__Terms'),
  'authservice:Privacy': extractTomlValue(authserviceTomL, 'ConsentVersions__Privacy'),
  'authservice:Cookies': extractTomlValue(authserviceTomL, 'ConsentVersions__Cookies'),
  'web:Terms': extractTomlValue(webToml, 'CONSENT_TERMS_VERSION'),
  'web:Privacy': extractTomlValue(webToml, 'CONSENT_PRIVACY_VERSION'),
  'web:Cookies': extractTomlValue(webToml, 'CONSENT_COOKIES_VERSION'),
  'docker-authservice:Terms': extractYamlEnvValue(dockerCompose, 'ConsentVersions__Terms'),
  'docker-authservice:Privacy': extractYamlEnvValue(dockerCompose, 'ConsentVersions__Privacy'),
  'docker-authservice:Cookies': extractYamlEnvValue(dockerCompose, 'ConsentVersions__Cookies'),
  'docker-web:Terms': extractYamlEnvValue(dockerCompose, 'CONSENT_TERMS_VERSION'),
  'docker-web:Privacy': extractYamlEnvValue(dockerCompose, 'CONSENT_PRIVACY_VERSION'),
};

// Note: CONSENT_COOKIES_VERSION in docker-compose may not exist yet;
// check it separately if it exists
const dockerWebCookies = extractYamlEnvValue(dockerCompose, 'CONSENT_COOKIES_VERSION');
if (dockerWebCookies) {
  versions['docker-web:Cookies'] = dockerWebCookies;
}

console.log('Consent versions found:');
Object.entries(versions).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});

// Check for missing values
const missing = Object.entries(versions).filter(([, value]) => value === null);
if (missing.length > 0) {
  console.error('\n❌ MISSING VALUES:');
  missing.forEach(([key]) => {
    console.error(`  ${key}`);
  });
  process.exit(1);
}

// Terms version check
const termsVersions = [
  versions['authservice:Terms'],
  versions['web:Terms'],
  versions['docker-authservice:Terms'],
  versions['docker-web:Terms'],
];
const termsOk = termsVersions.every(v => v === termsVersions[0]);

if (!termsOk) {
  console.error('\n❌ TERMS VERSION MISMATCH:');
  console.error(`  authservice: ${versions['authservice:Terms']}`);
  console.error(`  web: ${versions['web:Terms']}`);
  console.error(`  docker-authservice: ${versions['docker-authservice:Terms']}`);
  console.error(`  docker-web: ${versions['docker-web:Terms']}`);
  console.error('\nUpdate all four places to the same version.');
  process.exit(1);
}

// Privacy version check
const privacyVersions = [
  versions['authservice:Privacy'],
  versions['web:Privacy'],
  versions['docker-authservice:Privacy'],
  versions['docker-web:Privacy'],
];
const privacyOk = privacyVersions.every(v => v === privacyVersions[0]);

if (!privacyOk) {
  console.error('\n❌ PRIVACY VERSION MISMATCH:');
  console.error(`  authservice: ${versions['authservice:Privacy']}`);
  console.error(`  web: ${versions['web:Privacy']}`);
  console.error(`  docker-authservice: ${versions['docker-authservice:Privacy']}`);
  console.error(`  docker-web: ${versions['docker-web:Privacy']}`);
  console.error('\nUpdate all four places to the same version.');
  process.exit(1);
}

// Cookies version check (all places should have it)
const cookiesVersions = [
  versions['authservice:Cookies'],
  versions['web:Cookies'],
  versions['docker-authservice:Cookies'],
];

// docker-web:Cookies is optional for now (depends on if it's in docker-compose)
if (dockerWebCookies) {
  cookiesVersions.push(dockerWebCookies);
}

const cookiesOk = cookiesVersions.every(v => v === cookiesVersions[0]);

if (!cookiesOk) {
  console.error('\n❌ COOKIES VERSION MISMATCH:');
  console.error(`  authservice: ${versions['authservice:Cookies']}`);
  console.error(`  web: ${versions['web:Cookies']}`);
  console.error(`  docker-authservice: ${versions['docker-authservice:Cookies']}`);
  if (dockerWebCookies) {
    console.error(`  docker-web: ${versions['docker-web:Cookies']}`);
  }
  console.error('\nUpdate all four places to the same version.');
  process.exit(1);
}

console.log('\n✅ All consent versions match.');
process.exit(0);
