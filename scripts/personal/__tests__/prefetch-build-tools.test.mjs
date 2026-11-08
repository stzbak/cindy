import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { verifyAsset, gradleCachePath } from '../prefetch-build-tools.mjs';

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
