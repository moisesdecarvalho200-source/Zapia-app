import {
  EncryptedExportEnvelope,
  formatE2EEFingerprint,
  validateExportPassphrase,
} from './zapiaLogic';

const KEY_STORAGE_DB = 'zapia_keystore_v1';
const KEY_STORE_NAME = 'keys';
const MASTER_KEY_ID = 'zapia_aes_master';
const DEVICE_ID_KEY = 'current_device_id_v1';
const DEVICE_FP_SEED_KEY = 'device_fingerprint_seed_v1';

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KEY_STORAGE_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KEY_STORE_NAME)) {
        db.createObjectStore(KEY_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getKeyStoreItem<T>(key: string): Promise<T | undefined> {
  const db = await openKeyDb();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(KEY_STORE_NAME, 'readonly');
    const req = tx.objectStore(KEY_STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function putKeyStoreItem<T>(key: string, value: T): Promise<void> {
  const db = await openKeyDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(KEY_STORE_NAME, 'readwrite');
    tx.objectStore(KEY_STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getOrCreateMasterKey(): Promise<CryptoKey> {
  try {
    const existing = await getKeyStoreItem<CryptoKey>(MASTER_KEY_ID);
    if (existing) return existing;

    const generated = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    await putKeyStoreItem(MASTER_KEY_ID, generated);
    return generated;
  } catch {
    // Fallback ephemeral key in restricted environments
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
}

export async function getOrCreateDeviceId(): Promise<string> {
  try {
    const existing = await getKeyStoreItem<string>(DEVICE_ID_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,128}$/.test(existing)) {
      return existing;
    }
    const randomBytes = crypto.getRandomValues(new Uint8Array(8));
    const hex = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const created = `dev_${hex}`;
    await putKeyStoreItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    return `dev_${Date.now().toString(36)}`;
  }
}

export async function getOrCreateDeviceFingerprint(): Promise<string> {
  try {
    let seedHex = await getKeyStoreItem<string>(DEVICE_FP_SEED_KEY);
    if (!seedHex) {
      const rand = crypto.getRandomValues(new Uint8Array(32));
      seedHex = await computeSha256Hex(rand);
      await putKeyStoreItem(DEVICE_FP_SEED_KEY, seedHex);
    }
    return formatE2EEFingerprint(seedHex);
  } catch {
    const fallback = await computeSha256Hex(new TextEncoder().encode('zapia_fallback_device'));
    return formatE2EEFingerprint(fallback);
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  const hashBuffer = await crypto.subtle.digest('SHA-256', copy.buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function encryptBytesE2EE(
  bytes: Uint8Array
): Promise<{ encryptedBase64: string; ivBase64: string; sha256: string }> {
  const key = await getOrCreateMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plainCopy = new Uint8Array(bytes.length);
  plainCopy.set(bytes);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plainCopy.buffer
  );
  const sha256 = await computeSha256Hex(bytes);
  return {
    encryptedBase64: bytesToBase64(new Uint8Array(cipherBuffer)),
    ivBase64: bytesToBase64(iv),
    sha256,
  };
}

export async function decryptBytesE2EE(
  encryptedBase64: string,
  ivBase64: string
): Promise<Uint8Array> {
  const key = await getOrCreateMasterKey();
  const ivRaw = base64ToBytes(ivBase64);
  const iv = new Uint8Array(ivRaw.length);
  iv.set(ivRaw);
  const cipherRaw = base64ToBytes(encryptedBase64);
  const cipher = new Uint8Array(cipherRaw.length);
  cipher.set(cipherRaw);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipher.buffer
  );
  return new Uint8Array(plainBuffer);
}

async function derivePassphraseAesKey(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const rawKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const saltCopy = new Uint8Array(salt.length);
  saltCopy.set(salt);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltCopy.buffer,
      iterations: 120000,
      hash: 'SHA-256',
    },
    rawKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptBackupWithPassphrase(
  payloadJson: string,
  passphrase: string,
  meta: {
    ownerEmail: string;
    deviceId: string;
    e2eeFingerprint: string;
    summary: EncryptedExportEnvelope['summary'];
  }
): Promise<EncryptedExportEnvelope> {
  const check = validateExportPassphrase(passphrase);
  if (!check.valid) {
    throw new Error(check.reason || 'Senha inválida para exportação segura.');
  }

  const plainBytes = new TextEncoder().encode(payloadJson);
  const payloadSha256 = await computeSha256Hex(plainBytes);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await derivePassphraseAesKey(passphrase, salt);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plainBytes.buffer
  );

  return {
    format: 'zapia-e2ee-backup-v1',
    exportedAtIso: new Date().toISOString(),
    ownerEmail: meta.ownerEmail || 'local@zapia.app',
    deviceId: meta.deviceId,
    e2eeFingerprint: meta.e2eeFingerprint,
    kdf: 'PBKDF2-SHA256-120000',
    cipher: 'AES-256-GCM',
    saltBase64: bytesToBase64(salt),
    ivBase64: bytesToBase64(iv),
    ciphertextBase64: bytesToBase64(new Uint8Array(cipherBuffer)),
    payloadSha256,
    summary: meta.summary,
  };
}

export async function decryptBackupWithPassphrase(
  rawJson: string,
  passphrase: string
): Promise<{ envelope: EncryptedExportEnvelope; payloadJson: string }> {
  let envelope: EncryptedExportEnvelope;
  try {
    envelope = JSON.parse(rawJson) as EncryptedExportEnvelope;
  } catch {
    throw new Error('Arquivo JSON de backup inválido.');
  }

  if (
    envelope.format !== 'zapia-e2ee-backup-v1' ||
    !envelope.saltBase64 ||
    !envelope.ivBase64 ||
    !envelope.ciphertextBase64 ||
    !envelope.payloadSha256
  ) {
    throw new Error('Formato de arquivo não reconhecido como backup E2EE do ZAPIA.');
  }

  try {
    const salt = base64ToBytes(envelope.saltBase64);
    const ivRaw = base64ToBytes(envelope.ivBase64);
    const iv = new Uint8Array(ivRaw.length);
    iv.set(ivRaw);
    const cipherRaw = base64ToBytes(envelope.ciphertextBase64);
    const cipher = new Uint8Array(cipherRaw.length);
    cipher.set(cipherRaw);

    const aesKey = await derivePassphraseAesKey(passphrase, salt);
    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      cipher.buffer
    );
    const plainBytes = new Uint8Array(plainBuffer);
    const computedHash = await computeSha256Hex(plainBytes);
    if (computedHash !== envelope.payloadSha256) {
      throw new Error('Integridade SHA-256 divergente.');
    }
    return {
      envelope,
      payloadJson: new TextDecoder().decode(plainBytes),
    };
  } catch {
    throw new Error('Senha incorreta ou backup criptografado corrompido.');
  }
}

