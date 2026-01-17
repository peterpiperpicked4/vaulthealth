/**
 * Cryptographic utilities
 */

export async function sha256(data: ArrayBuffer | string): Promise<string> {
  const buffer =
    typeof data === 'string' ? new TextEncoder().encode(data) : data;

  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateId(): string {
  // UUID v4 using crypto.randomUUID if available, otherwise fallback
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
