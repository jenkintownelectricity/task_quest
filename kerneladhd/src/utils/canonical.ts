// Stable JSON canonicalization + content hashing

export function canonicalize(obj: unknown): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'boolean' || typeof obj === 'number') return JSON.stringify(obj);
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalize).join(',') + ']';
  }
  if (typeof obj === 'object') {
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const pairs = keys.map(
      (k) => JSON.stringify(k) + ':' + canonicalize((obj as Record<string, unknown>)[k])
    );
    return '{' + pairs.join(',') + '}';
  }
  return '';
}

export async function computeHash(data: unknown): Promise<string> {
  const canonical = canonicalize(data);
  const encoder = new TextEncoder();
  const buffer = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateId(prefix: string = 'id'): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${ts}_${rand}`;
}
