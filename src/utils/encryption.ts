/**
 * Client-side encryption for Supabase API keys.
 * Uses Web Crypto API with AES-GCM for secure local storage.
 */

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptKey(plaintext: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);

  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );

  // Format: salt(16) + iv(12) + encrypted data as base64
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  return btoa(String.fromCharCode(...combined));
}

export async function decryptKey(ciphertext: string, passphrase: string): Promise<string> {
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));

  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encrypted = combined.slice(28);

  const key = await deriveKey(passphrase, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );

  return new TextDecoder().decode(decrypted);
}

export function generatePassphrase(): string {
  const words = [
    'axiom', 'bloom', 'crane', 'dusk', 'ember', 'frost', 'glim', 'haze',
    'iris', 'jade', 'kite', 'lune', 'mint', 'nova', 'onyx', 'peak',
  ];
  const parts: string[] = [];
  for (let i = 0; i < 4; i++) {
    parts.push(words[Math.floor(Math.random() * words.length)]);
  }
  return parts.join('-');
}

export function isKeyEncrypted(key: string): boolean {
  try {
    const decoded = atob(key);
    return decoded.length > 28;
  } catch {
    return false;
  }
}
