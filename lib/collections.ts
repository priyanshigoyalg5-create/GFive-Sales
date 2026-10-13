/** The four GFive lines (same as gfive.co.in). Stored on each sample as `collection`. */
export const COLLECTIONS = [
  { id: 'rozana', name: 'Rozana', tagline: 'Everyday bestsellers', range: '₹2,000 – ₹2,500', tone: 'from-[#e9dcc0] to-[#d8c39a]' },
  { id: 'tyohar', name: 'Tyohar', tagline: 'Festive & partywear', range: '₹2,500 – ₹4,000', tone: 'from-[#e7c9a4] to-[#c98f52]' },
  { id: 'shudh', name: 'Shudh', tagline: 'Refined, elevated fabrics', range: '₹4,000 – ₹7,000', tone: 'from-[#cfdcc4] to-[#8fab78]' },
  { id: 'maharani', name: 'Maharani', tagline: 'Statement handwork', range: '₹10,000 – ₹35,000', tone: 'from-[#d9c08a] to-[#9a6f1e]' },
] as const;

export type CollectionId = (typeof COLLECTIONS)[number]['id'];

export function collectionName(id?: string): string | undefined {
  return COLLECTIONS.find((c) => c.id === id)?.name;
}
