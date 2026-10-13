/** Design categories (mandatory on every sample). Stored as the id. */
export const CATEGORIES = [
  { id: 'tyohaar', name: 'Tyohaar' },
  { id: 'rozana', name: 'Rozana' },
  { id: 'maharani', name: 'Maharani' },
  { id: 'shudh', name: 'Shudh' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

const LEGACY: Record<string, CategoryId> = { tyohar: 'tyohaar' };

export function normCategory(v?: string | null): CategoryId | '' {
  const k = String(v || '').trim().toLowerCase();
  const id = (LEGACY[k] || k) as CategoryId;
  return CATEGORIES.some((c) => c.id === id) ? id : '';
}

export function categoryName(v?: string | null): string {
  const id = normCategory(v);
  return CATEGORIES.find((c) => c.id === id)?.name || '';
}
