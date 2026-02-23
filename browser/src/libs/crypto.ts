// AES-GCM encryption with PBKDF2 key derivation and TOTP support
// All via Web Crypto API — zero external dependencies

const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

// --- Helpers ---

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// --- Key derivation ---

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// --- AES-GCM encrypt / decrypt ---

export interface EncryptedData {
  iv: string;   // base64
  data: string;  // base64
}

export async function encrypt(key: CryptoKey, plaintext: string): Promise<EncryptedData> {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  return {
    iv: toBase64(iv),
    data: toBase64(ciphertext),
  };
}

export async function decrypt(key: CryptoKey, iv: string, data: string): Promise<string> {
  const dec = new TextDecoder();
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv) },
    key,
    fromBase64(data)
  );
  return dec.decode(plaintext);
}

// --- TOTP (RFC 6238) ---

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Uint8Array {
  const cleaned = input.replace(/[\s=-]/g, '').toUpperCase();
  const bits: number[] = [];
  for (const c of cleaned) {
    const val = BASE32_CHARS.indexOf(c);
    if (val === -1) continue;
    for (let i = 4; i >= 0; i--) bits.push((val >> i) & 1);
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i * 8 + j];
    bytes[i] = byte;
  }
  return bytes;
}

export async function generateTOTP(
  secret: string,
  period = 30,
  digits = 6
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    base32Decode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const counter = Math.floor(Date.now() / 1000 / period);
  const counterBytes = new ArrayBuffer(8);
  const view = new DataView(counterBytes);
  view.setUint32(4, counter, false); // big-endian, lower 32 bits

  const hmac = await crypto.subtle.sign('HMAC', key, counterBytes);
  const hmacBytes = new Uint8Array(hmac);

  // Dynamic truncation
  const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;
  const code =
    ((hmacBytes[offset] & 0x7f) << 24) |
    ((hmacBytes[offset + 1] & 0xff) << 16) |
    ((hmacBytes[offset + 2] & 0xff) << 8) |
    (hmacBytes[offset + 3] & 0xff);

  return String(code % 10 ** digits).padStart(digits, '0');
}

export function getTOTPTimeRemaining(period = 30): number {
  return period - (Math.floor(Date.now() / 1000) % period);
}

// --- otpauth:// URI parsing ---

export interface OTPAuthParams {
  secret: string;
  issuer?: string;
  period: number;
  digits: number;
  algorithm: string;
}

export function parseOTPAuthURI(uri: string): OTPAuthParams | null {
  try {
    const url = new URL(uri);
    if (url.protocol !== 'otpauth:') return null;

    const params = url.searchParams;
    const secret = params.get('secret');
    if (!secret) return null;

    return {
      secret: secret.toUpperCase(),
      issuer: params.get('issuer') ?? undefined,
      period: parseInt(params.get('period') ?? '30', 10) || 30,
      digits: parseInt(params.get('digits') ?? '6', 10) || 6,
      algorithm: (params.get('algorithm') ?? 'SHA1').toUpperCase(),
    };
  } catch {
    return null;
  }
}
