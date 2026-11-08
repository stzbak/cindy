export const PERSONAL_ANDROID_CERTIFICATE_SHA256 = 'e7e234dfe1541acd2e9926b2198bfaaba2fe5dba842e4b2cee1ae4940c88efb7';

/** SDK versions differ in signer labels; pin every APK signer, not source stamps. */
export function assertPersonalAndroidSignature(output) {
  const fingerprints = [...output.matchAll(/^(?:V\d+(?:\.\d+)?\s+)?Signer\b[^\r\n]* certificate SHA-256 digest:\s*([a-f0-9]{64})\s*$/gim)]
    .map(match => match[1].toLowerCase());
  if (!fingerprints.length) throw new Error('Unrecognized apksigner certificate output');
  if (fingerprints.some(value => value !== PERSONAL_ANDROID_CERTIFICATE_SHA256)) {
    throw new Error('Unexpected Android signer certificate SHA256: ' + [...new Set(fingerprints)].join(', '));
  }
  return PERSONAL_ANDROID_CERTIFICATE_SHA256;
}
