const KEY_STORAGE_DB = 'zapia_keystore_v1';
const KEY_STORE_NAME = 'keys';
const MASTER_KEY_ID = 'zapia_aes_master';

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

async function getOrCreateMasterKey(): Promise<CryptoKey> {
  try {
    const db = await openKeyDb();
    const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
      const tx = db.transaction(KEY_STORE_NAME, 'readonly');
      const req = tx.objectStore(KEY_STORE_NAME).get(MASTER_KEY_ID);
      req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
      req.onerror = () => reject(req.error);
    });
    if (existing) return existing;

    const generated = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(KEY_STORE_NAME, 'readwrite');
      tx.objectStore(KEY_STORE_NAME).put(generated, MASTER_KEY_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return generated;
  } catch {
    // Fallback ephemeral key in restricted environments
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
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
