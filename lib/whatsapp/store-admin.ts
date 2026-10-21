import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../server/firebase-admin';
import { DEFAULT_SETTINGS } from '../settings-defaults';
import type { CompanySettings, Order, PublicStaff, Sample } from '../types';
import { readFilter, type Lead } from '../leads';
import { DEFAULT_KEYWORDS, type BotConfig, type SocialConfig, type SocialSession, type SocialStore, type WaSession } from './store';

/** Firestore (firebase-admin) implementation used by the live webhook. */
export function adminStore(): SocialStore {
  const db = adminDb();
  let samplesCache: Sample[] | null = null;
  let teamCache: PublicStaff[] | null = null;
  return {
    async claimMessage(wamid) {
      try {
        await db.doc(`waInbound/${wamid.replace(/[^A-Za-z0-9_.=-]/g, '_')}`).create({ at: Date.now() });
        return true;
      } catch {
        return false; // already exists
      }
    },
    async getConfig(): Promise<BotConfig> {
      const d = (await db.doc('config/whatsapp').get()).data() || {};
      return { on: d.on === true, testNumbers: Array.isArray(d.testNumbers) ? d.testNumbers : [], provider: d.provider === 'wati' ? 'wati' : 'meta' };
    },
    async getSettings(): Promise<CompanySettings> {
      const d = (await db.doc('settings/company').get()).data() || {};
      return { ...DEFAULT_SETTINGS, ...(d as Partial<CompanySettings>) };
    },
    async getSession(phone) {
      return ((await db.doc(`waSessions/${phone}`).get()).data() as WaSession) || {};
    },
    async saveSession(phone, patch) {
      const data: Record<string, unknown> = { ...patch, updatedAt: Date.now() };
      if (patch.state === '') {
        data.state = FieldValue.delete();
        data.stateAt = FieldValue.delete();
      }
      await db.doc(`waSessions/${phone}`).set(data, { merge: true });
    },
    async samples() {
      if (!samplesCache) {
        const snap = await db.collection('samples').orderBy('createdAt', 'desc').limit(300).get();
        samplesCache = snap.docs.map((d) => ({ ...(d.data() as Omit<Sample, 'id'>), id: d.id })).filter((s) => !s.isTrashed);
      }
      return samplesCache;
    },
    async ordersByPhone(phone) {
      const ten = phone.replace(/^91/, '').slice(-10);
      const variants = [ten, `91${ten}`, `+91${ten}`, `+91 ${ten}`, `0${ten}`];
      const snap = await db.collection('orders').where('mobile', 'in', variants).get();
      return snap.docs
        .map((d) => ({ ...(d.data() as Omit<Order, 'id'>), id: d.id }))
        .sort((a, b) => ((b.createdAt as unknown as { toMillis?: () => number })?.toMillis?.() || 0) - ((a.createdAt as unknown as { toMillis?: () => number })?.toMillis?.() || 0));
    },
    async team() {
      if (!teamCache) {
        const snap = await db.collection('publicStaff').get();
        teamCache = snap.docs.map((d) => ({ ...(d.data() as PublicStaff), uid: d.id }));
      }
      return teamCache;
    },
    async receivers() {
      const d = (await db.doc('settings/leads').get()).data();
      return Array.isArray(d?.receivers) ? (d!.receivers as string[]) : [];
    },
    async openLeadCounts() {
      const snap = await db.collection('leads').where('status', 'in', ['new', 'contacted', 'interested']).select('assignedUid').get();
      const m = new Map<string, number>();
      snap.docs.forEach((d) => {
        const u = d.get('assignedUid');
        if (u) m.set(u, (m.get(u) || 0) + 1);
      });
      return m;
    },
    async getLead(id) {
      const d = await db.doc(`leads/${id}`).get();
      return d.exists ? ({ ...(d.data() as Omit<Lead, 'id'>), id: d.id } as Lead) : null;
    },
    async createLead(data) {
      const ref = await db.collection('leads').add({
        ...data,
        notes: data.notes || [],
        assignedAt: data.assignedUid ? FieldValue.serverTimestamp() : null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return ref.id;
    },
    async updateLead(id, patch) {
      await db.doc(`leads/${id}`).set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    },
    // ---------- Instagram / Facebook
    async getSocialConfig(): Promise<SocialConfig> {
      const d = (await db.doc('config/social').get()).data() || {};
      const kw = Array.isArray(d.keywords) && d.keywords.length ? (d.keywords as string[]) : DEFAULT_KEYWORDS;
      return { on: d.on === true, keywords: kw, showRate: d.showRate === true };
    },
    async getSocialSession(key) {
      return ((await db.doc(`socialSessions/${key}`).get()).data() as SocialSession) || {};
    },
    async saveSocialSession(key, patch) {
      const data: Record<string, unknown> = { ...patch, updatedAt: Date.now() };
      if (patch.state === '') data.state = FieldValue.delete();
      await db.doc(`socialSessions/${key}`).set(data, { merge: true });
    },
    async sampleForPost(id) {
      const ig = await db.collection('socialPosts').where('igMediaId', '==', id).limit(1).get();
      if (!ig.empty) return ig.docs[0].get('sampleId');
      const fb = await db.collection('socialPosts').where('fbPostId', '==', id).limit(1).get();
      return fb.empty ? null : fb.docs[0].get('sampleId');
    },
    async getLeadFilter() {
      return readFilter((await db.doc('settings/leads').get()).data());
    },
    async savePost(data) {
      await db.collection('socialPosts').add({ ...data, at: FieldValue.serverTimestamp() });
    },
  };
}
