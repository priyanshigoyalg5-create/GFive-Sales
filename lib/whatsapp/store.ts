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
}

export interface BotConfig {
  on: boolean; // bot switched on by the Super Admin
  testNumbers: string[]; // if set, the bot answers only these numbers (91XXXXXXXXXX)
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
