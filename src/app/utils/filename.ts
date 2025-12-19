export function sanitizeFilenamePart(input: string): string {
  const trimmed = input.trim();
  const normalized = trimmed.replace(/[^a-z0-9-_]+/gi, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return normalized || 'profile';
}

