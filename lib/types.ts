import type { Timestamp } from 'firebase/firestore';

export type Role = 'admin' | 'superadmin';

export interface StaffProfile {
  uid: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  whatsappNumber?: string; // digits with country code; orders from this person's links open this chat
  nameConfirmed?: boolean; // the person typed their own name (first sign-in)
  createdAt?: Timestamp | null;
}

/** Public part of a staff profile (readable by customers' order page): publicStaff/{uid}. */
export interface PublicStaff {
  uid: string;
  name: string;
  whatsappNumber: string;
  active: boolean;
}

export interface ColorDetail {
  name: string;
  photoUrl: string;
}

/** Shape stored in the `samples` collection (kept compatible with old data). */
export interface Sample {
  id: string;
  designNumber: string;
  price: number;
  fabric?: string;
  work?: string;
  category?: string; // tyohaar | rozana | maharani | shudh (mandatory for new samples)
  description?: string;
  salesPerson?: string;
  colors?: string[];
  colorDetails?: ColorDetail[];
  imageUrl?: string;
  sampleImages?: string[];
  isTrashed?: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  createdBy?: string; // creator e-mail (legacy)
  createdByUid?: string; // sample owner (creator) — set automatically
  createdByName?: string;
}

export type OrderStatus = 'Pending' | 'Dispatched' | 'Completed' | 'Cancelled';

/** One design inside an order. */
export interface OrderLine {
  sampleId: string;
  designNumber: string;
  price: number;
  fabric?: string;
  work?: string;
  salesPerson?: string;
  category?: string;
  image?: string;
  items: Record<string, number>;
  colorPhotos: Record<string, string>;
  totalQuantity: number;
  totalAmount: number;
}

/** Shape stored in `orders`. Old orders only have the single-design top-level fields. */
export interface Order {
  id: string;
  orderId?: string;
  lines?: OrderLine[];
  // legacy single-design fields
  sampleId?: string;
  designNumber?: string;
  designNumbers?: string[];
  price?: number;
  items?: Record<string, number>;
  colorPhotos?: Record<string, string>;
  salesPerson?: string; // display name of the salesperson credited (legacy + new)
  // attribution (new orders)
  salesPersonUid?: string; // staff whose shared link brought the order ('' = unassigned)
  salesPersonName?: string;
  sampleCreatorUid?: string; // who added the sample — kept separate from the salesperson
  sampleCreatorName?: string;
  category?: string;
  // customer
  firmName: string;
  mobile: string;
  city: string;
  gstNo?: string;
  agentName?: string;
  remarks?: string;
  totalQuantity: number;
  totalAmount: number;
  unit?: string;
  status?: OrderStatus;
  isTrashed?: boolean;
  createdAt?: Timestamp | null;
}

export interface CompanySettings {
  companyName: string;
  addressLine: string;
  email: string;
  website: string;
  gstin: string;
  whatsappNumber: string; // with country code, digits only
  storePhone: string;
  instagram: string;
  invoiceNote: string;
}
