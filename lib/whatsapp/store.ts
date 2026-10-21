import type { CompanySettings, Order, PublicStaff, Sample } from '../types';
import type { Lead } from '../leads';

/** Everything the bot reads/writes. Implemented with firebase-admin (store-admin.ts) and in memory for tests. */
export interface WaSession {
  name?: string;
  state?: '' | 'care' | 'order_ask';
  stateAt?: number;
  leadId?: string;
  assignedUid?: string;
  lastInboundAt?: number;
  optOut?: boolean;
  choices?: Record<string, string>; // last menu shown: button/row title (and 1,2,3…) → action id (for WATI / typed replies)
}

export interface BotConfig {
  on: boolean; // bot switched on by the Super Admin
  testNumbers: string[]; // if set, the bot answers only these numbers (91XXXXXXXXXX)
  provider: 'meta' | 'wati'; // where the business number is connected
}

export interface BotStore {
  claimMessage(wamid: string): Promise<boolean>; // false = already handled (Meta retries)
  getConfig(): Promise<BotConfig>;
  getSettings(): Promise<CompanySettings>;
  getSession(phone: string): Promise<WaSession>;
  saveSession(phone: string, patch: Partial<WaSession> & { state?: WaSession['state'] }): Promise<void>;
  samples(): Promise<Sample[]>; // live (not trashed), newest first
  ordersByPhone(phone: string): Promise<Order[]>; // newest first
  team(): Promise<PublicStaff[]>;
  receivers(): Promise<string[]>;
  openLeadCounts(): Promise<Map<string, number>>;
  getLead(id: string): Promise<Lead | null>;
  createLead(data: Omit<Lead, 'id'>): Promise<string>;
  updateLead(id: string, patch: Partial<Lead>): Promise<void>;
}

/** Instagram / Facebook (Meta) side — same database. */
export interface SocialConfig {
  on: boolean; // auto-replies to DMs and comments
  keywords: string[]; // comment words that trigger a private DM
  showRate: boolean; // put the rate in post captions
}

export interface SocialSession {
  leadId?: string;
  name?: string;
  state?: '' | 'phone_ask';
  updatedAt?: number;
}

export interface SocialStore extends BotStore {
  getSocialConfig(): Promise<SocialConfig>;
  getSocialSession(key: string): Promise<SocialSession>;
  saveSocialSession(key: string, patch: Partial<SocialSession>): Promise<void>;
  sampleForPost(mediaOrPostId: string): Promise<string | null>; // → sample id
  getLeadFilter(): Promise<import('../leads').LeadFilter>;
  savePost(data: { sampleId: string; igMediaId?: string; fbPostId?: string; by: string }): Promise<void>;
}

export const DEFAULT_KEYWORDS = ['price', 'rate', 'pp', 'details', 'detail', 'dm', 'kitna', 'cost', 'order', 'available', 'wholesale', 'interested'];
