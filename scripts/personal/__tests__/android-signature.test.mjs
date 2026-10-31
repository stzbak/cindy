import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPersonalAndroidSignature, PERSONAL_ANDROID_CERTIFICATE_SHA256 as cert } from '../android-signature.mjs';

// Unit: release validation must accept SDK signer labels without accepting a
// changed key or mistaking a source-stamp certificate for the APK signer.
for (const label of ['Signer #1', 'V3.0 Signer', 'V2 Signer #1', 'V3.1 Signer: (minSdkVersion=33, maxSdkVersion=2147483647)']) {
  test('accepts SDK signer label ' + label, () => {
    assert.equal(assertPersonalAndroidSignature(label + ' certificate SHA-256 digest: ' + cert.toUpperCase() + '\n'), cert);
  });
}
test('rejects unknown output, source-stamp-only output and a changed or extra signing key', () => {
  for (const output of [
    '', 'Source Stamp Signer certificate SHA-256 digest: ' + cert,
    'Signer #1 certificate SHA-256 digest: ' + 'a'.repeat(64),
    'Signer #1 certificate SHA-256 digest: ' + cert + '\nSigner #2 certificate SHA-256 digest: ' + 'a'.repeat(64),
  ]) assert.throws(() => assertPersonalAndroidSignature(output));
});
