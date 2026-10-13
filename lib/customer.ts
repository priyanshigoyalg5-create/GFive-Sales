'use client';

/** Remembers the customer's firm details on this device so repeat orders are quick. */
const CUSTOMER_KEY = 'gfive.customer.v1';
export function loadCustomer<T>(fallback: T): T {
  try {
    const raw = localStorage.getItem(CUSTOMER_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
export function saveCustomer(v: unknown) {
  try {
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}
