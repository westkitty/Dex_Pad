const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class CryptoError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CryptoError';
  }
}

export class TamperedCiphertextError extends CryptoError {
  constructor(message = 'Ciphertext authentication failed: data was tampered or key is incorrect') {
    super(message);
    this.name = 'TamperedCiphertextError';
  }
}

export function toHex(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function fromHex(hex) {
  if (typeof hex !== 'string' || hex.length % 2 !== 0) {
    throw new CryptoError('Invalid hex string');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function toBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function fromBase64(b64) {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function randomBytes(n) {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export async function deriveHkdfMasterKey({ passphrase, salt, iterations = 100_000 }) {
  const saltBytes = typeof salt === 'string' ? fromHex(salt) : salt;
  const passBytes = encoder.encode(passphrase);

  const baseKey = await globalThis.crypto.subtle.importKey(
    'raw',
    passBytes,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    256 // 32 bytes
  );

  return globalThis.crypto.subtle.importKey(
    'raw',
    derivedBits,
    'HKDF',
    false,
    ['deriveKey']
  );
}

export async function deriveSubKey(hkdfBaseKey, { info, length = 256, usages = ['encrypt', 'decrypt'] }) {
  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(),
      info: encoder.encode(info),
    },
    hkdfBaseKey,
    { name: 'AES-GCM', length },
    true,
    usages
  );
}

export async function encryptGcm({ key, plaintext, iv, additionalData }) {
  const plainBytes = typeof plaintext === 'string' ? encoder.encode(plaintext) : plaintext;
  const ivBytes = typeof iv === 'string' ? fromHex(iv) : iv;
  const aadBytes = additionalData ? (typeof additionalData === 'string' ? encoder.encode(additionalData) : additionalData) : undefined;

  const cipherBuffer = await globalThis.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes,
      additionalData: aadBytes,
      tagLength: 128,
    },
    key,
    plainBytes
  );

  return new Uint8Array(cipherBuffer);
}

export async function decryptGcm({ key, ciphertext, iv, additionalData }) {
  const cipherBytes = typeof ciphertext === 'string' ? fromBase64(ciphertext) : ciphertext;
  const ivBytes = typeof iv === 'string' ? fromHex(iv) : iv;
  const aadBytes = additionalData ? (typeof additionalData === 'string' ? encoder.encode(additionalData) : additionalData) : undefined;

  try {
    const plainBuffer = await globalThis.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes,
        additionalData: aadBytes,
        tagLength: 128,
      },
      key,
      cipherBytes
    );
    return new Uint8Array(plainBuffer);
  } catch (err) {
    throw new TamperedCiphertextError();
  }
}
