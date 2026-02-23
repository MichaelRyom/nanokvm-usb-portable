import { generateSalt, deriveKey, encrypt, decrypt } from '@/libs/crypto';

const VAULT_STORAGE_KEY = 'nanokvm-usb-credential-vault';
const AUTO_LOCK_KEY = 'nanokvm-usb-vault-auto-lock';
const HIDE_TOTP_KEY = 'nanokvm-usb-vault-hide-totp';
const DEFAULT_AUTO_LOCK_MINUTES = 5;

// --- Types ---

export interface Credential {
  id: string;
  name: string;
  username: string;
  password: string;
  totpSecret?: string;  // base32 TOTP secret
  totpPeriod?: number;   // default 30
  totpDigits?: number;   // default 6
  notes?: string;
  tags?: string[];
  favorite?: boolean;
  createdAt: number;
  updatedAt: number;
}

interface EncryptedVault {
  version: 1;
  salt: string;  // base64
  iv: string;    // base64
  data: string;  // base64 (encrypted JSON of Credential[])
}

// --- Singleton vault ---

let derivedKey: CryptoKey | null = null;
let cachedCredentials: Credential[] | null = null;
let lastActivity = 0;

function resetState() {
  derivedKey = null;
  cachedCredentials = null;
  lastActivity = 0;
}

function touchActivity() {
  lastActivity = Date.now();
}

// --- Auto-lock ---

export function getAutoLockMinutes(): number {
  const val = localStorage.getItem(AUTO_LOCK_KEY);
  if (val) {
    const n = parseInt(val, 10);
    if (!isNaN(n) && n >= 0) return n; // 0 = disabled
  }
  return DEFAULT_AUTO_LOCK_MINUTES;
}

export function setAutoLockMinutes(minutes: number): void {
  localStorage.setItem(AUTO_LOCK_KEY, String(Math.max(0, Math.floor(minutes))));
}

export function getHideTOTP(): boolean {
  return localStorage.getItem(HIDE_TOTP_KEY) !== 'false'; // default true
}

export function setHideTOTP(hide: boolean): void {
  localStorage.setItem(HIDE_TOTP_KEY, hide ? 'true' : 'false');
}

function checkAutoLock(): boolean {
  const minutes = getAutoLockMinutes();
  if (minutes === 0) return false; // disabled
  if (lastActivity === 0) return false;
  return Date.now() - lastActivity > minutes * 60 * 1000;
}

// --- Storage ---

function loadVault(): EncryptedVault | null {
  const raw = localStorage.getItem(VAULT_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EncryptedVault;
  } catch {
    return null;
  }
}

function saveVault(vault: EncryptedVault): void {
  localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vault));
}

// --- Public API ---

export function isInitialized(): boolean {
  return loadVault() !== null;
}

export function isUnlocked(): boolean {
  if (!derivedKey) return false;
  if (checkAutoLock()) {
    lock();
    return false;
  }
  return true;
}

export function lock(): void {
  resetState();
}

export async function initialize(masterPassword: string): Promise<void> {
  const salt = generateSalt();
  const key = await deriveKey(masterPassword, salt);
  const encrypted = await encrypt(key, JSON.stringify([]));

  const vault: EncryptedVault = {
    version: 1,
    salt: btoa(String.fromCharCode(...salt)),
    iv: encrypted.iv,
    data: encrypted.data,
  };
  saveVault(vault);

  derivedKey = key;
  cachedCredentials = [];
  touchActivity();
}

export async function unlock(masterPassword: string): Promise<boolean> {
  const vault = loadVault();
  if (!vault) return false;

  try {
    const salt = Uint8Array.from(atob(vault.salt), (c) => c.charCodeAt(0));
    const key = await deriveKey(masterPassword, salt);
    const json = await decrypt(key, vault.iv, vault.data);
    cachedCredentials = JSON.parse(json) as Credential[];
    derivedKey = key;
    touchActivity();
    return true;
  } catch {
    // Wrong password or corrupted vault
    return false;
  }
}

export function getCredentials(): Credential[] {
  if (!isUnlocked()) return [];
  touchActivity();
  // Sort: favorites first, then alphabetically by name
  return [...(cachedCredentials ?? [])].sort((a, b) => {
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

export async function toggleFavorite(id: string): Promise<boolean> {
  if (!isUnlocked() || !cachedCredentials) return false;
  const idx = cachedCredentials.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  cachedCredentials[idx] = {
    ...cachedCredentials[idx],
    favorite: !cachedCredentials[idx].favorite,
    updatedAt: Date.now(),
  };
  await persistCredentials();
  touchActivity();
  return true;
}

async function persistCredentials(): Promise<void> {
  if (!derivedKey || !cachedCredentials) return;
  const vault = loadVault();
  if (!vault) return;

  const encrypted = await encrypt(derivedKey, JSON.stringify(cachedCredentials));
  vault.iv = encrypted.iv;
  vault.data = encrypted.data;
  saveVault(vault);
}

function generateId(): string {
  return crypto.getRandomValues(new Uint32Array(2)).join('-');
}

export async function addCredential(
  entry: Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Credential | null> {
  if (!isUnlocked() || !cachedCredentials) return null;

  const now = Date.now();
  const credential: Credential = {
    ...entry,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  cachedCredentials.push(credential);
  await persistCredentials();
  touchActivity();
  return credential;
}

export async function updateCredential(
  id: string,
  updates: Partial<Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<boolean> {
  if (!isUnlocked() || !cachedCredentials) return false;

  const idx = cachedCredentials.findIndex((c) => c.id === id);
  if (idx === -1) return false;

  cachedCredentials[idx] = {
    ...cachedCredentials[idx],
    ...updates,
    updatedAt: Date.now(),
  };
  await persistCredentials();
  touchActivity();
  return true;
}

export async function deleteCredential(id: string): Promise<boolean> {
  if (!isUnlocked() || !cachedCredentials) return false;

  const idx = cachedCredentials.findIndex((c) => c.id === id);
  if (idx === -1) return false;

  cachedCredentials.splice(idx, 1);
  await persistCredentials();
  touchActivity();
  return true;
}

export async function changeMasterPassword(
  oldPassword: string,
  newPassword: string
): Promise<boolean> {
  // Verify old password first
  const vault = loadVault();
  if (!vault) return false;

  try {
    const salt = Uint8Array.from(atob(vault.salt), (c) => c.charCodeAt(0));
    const oldKey = await deriveKey(oldPassword, salt);
    const json = await decrypt(oldKey, vault.iv, vault.data);
    const credentials = JSON.parse(json) as Credential[];

    // Re-encrypt with new password and new salt
    const newSalt = generateSalt();
    const newKey = await deriveKey(newPassword, newSalt);
    const encrypted = await encrypt(newKey, JSON.stringify(credentials));

    const newVault: EncryptedVault = {
      version: 1,
      salt: btoa(String.fromCharCode(...newSalt)),
      iv: encrypted.iv,
      data: encrypted.data,
    };
    saveVault(newVault);

    derivedKey = newKey;
    cachedCredentials = credentials;
    touchActivity();
    return true;
  } catch {
    return false;
  }
}

export function deleteVault(): void {
  localStorage.removeItem(VAULT_STORAGE_KEY);
  resetState();
}

// --- Import / Export ---

export function exportVault(): string | null {
  const raw = localStorage.getItem(VAULT_STORAGE_KEY);
  if (!raw) return null;
  return raw; // Already encrypted JSON
}

export async function importVault(
  data: string,
  masterPassword: string
): Promise<boolean> {
  try {
    const imported = JSON.parse(data) as EncryptedVault;
    if (imported.version !== 1 || !imported.salt || !imported.iv || !imported.data) {
      return false;
    }

    // Verify the password works against the imported vault
    const salt = Uint8Array.from(atob(imported.salt), (c) => c.charCodeAt(0));
    const key = await deriveKey(masterPassword, salt);
    const json = await decrypt(key, imported.iv, imported.data);
    const credentials = JSON.parse(json) as Credential[];

    // Valid — save to localStorage and unlock
    saveVault(imported);
    derivedKey = key;
    cachedCredentials = credentials;
    touchActivity();
    return true;
  } catch {
    return false;
  }
}
