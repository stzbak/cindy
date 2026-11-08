import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { verifyAsset, gradleCachePath, kotlinCompilerVersions, builderTools } from '../prefetch-build-tools.mjs';

test('builder prefetch reads locked NSIS versions and checksums without selecting unrelated tools', () => {
  const tools = builderTools(['getBinFromUrl)("nsis", "1.2.3", "YWJj="); getBinFromUrl)("other", "9.9.9", "YWJj=");']);
  assert.deepEqual(tools, [{ name: 'nsis', version: '1.2.3', checksum: 'YWJj=' }]);
  assert.deepEqual(builderTools(['unsupported dependency format']), []);
});

test('collects each upstream Kotlin compiler declaration and the AGP requirement', () => {
  const module = {
    variants: [{ dependencies: [{ group: 'org.jetbrains.kotlin', module: 'kotlin-gradle-plugin', version: { requires: '2.2.10' } }] }],
  };
  const texts = ['kotlin = "2.2.0"', 'mockito-kotlin = "3.2.0"', '  kotlin("jvm") version "2.2.21" apply false'];
  assert.deepEqual(kotlinCompilerVersions(texts, module), ['2.2.0', '2.2.10', '2.2.21']);
  assert.deepEqual(kotlinCompilerVersions([], { variants: [] }), ['2.2.0', '2.2.10', '2.2.21']);
});

test('asset verification requires matching publisher checksum, GitHub digest and bytes', () => {
  const bytes = Buffer.from('official archive');
  const hash = createHash('sha256').update(bytes).digest('hex');
  assert.doesNotThrow(() => verifyAsset(bytes, hash, 'sha256:' + hash));
  assert.throws(() => verifyAsset(Buffer.from('truncated'), hash, 'sha256:' + hash));
  assert.throws(() => verifyAsset(bytes, hash, null));
  assert.throws(() => verifyAsset(bytes, 'a'.repeat(64), 'sha256:' + hash));
  assert.throws(() => verifyAsset(bytes, undefined, undefined));
});

test('Gradle cache matches wrapper URL hash and refuses unrelated distribution hosts', () => {
  assert.equal(gradleCachePath('https://services.gradle.org/distributions/gradle-9.4.1-bin.zip', '/cache'),
    path.join('/cache', 'wrapper', 'dists', 'gradle-9.4.1-bin', 'arn2x92ynaizyzdaamcbpbhtj', 'gradle-9.4.1-bin.zip'));
  assert.throws(() => gradleCachePath('https://example.invalid/gradle-9.4.1-bin.zip', '/cache'));
  assert.throws(() => gradleCachePath('https://services.gradle.org/distributions/not-gradle.zip', '/cache'));
});
