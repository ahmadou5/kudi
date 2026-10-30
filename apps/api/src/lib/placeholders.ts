export function isRealCredential(value?: string | null): boolean {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.includes('_here')) return false;
  if (normalized.startsWith('your_') || normalized.startsWith('your-')) return false;
  if (['changeme', 'change_me', 'placeholder', 'xxx', 'todo'].includes(normalized)) return false;
  return true;
}
