'use client';

import { RecaptchaVerifier, linkWithPhoneNumber, signInWithPhoneNumber, type ConfirmationResult, type User } from 'firebase/auth';
import { getAppAuth } from './firebase';

/** Indian 10-digit mobile → +91XXXXXXXXXX ('' if not valid). */
export function toE164(v: string): string {
  let d = (v || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : '';
}

let verifier: RecaptchaVerifier | null = null;
function freshVerifier(containerId: string, visible: boolean) {
  try {
    verifier?.clear();
  } catch {
    /* already gone */
  }
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = '';
  verifier = new RecaptchaVerifier(getAppAuth(), containerId, { size: visible ? 'normal' : 'invisible' });
  return verifier;
}

/** Sends the OTP. With `link`, the mobile is added to the signed-in (e-mail) account instead of signing in. */
export async function sendOtp(phone: string, containerId: string, opts: { link?: User; visible?: boolean } = {}): Promise<ConfirmationResult> {
  const v = freshVerifier(containerId, !!opts.visible);
  return opts.link ? linkWithPhoneNumber(opts.link, phone, v) : signInWithPhoneNumber(getAppAuth(), phone, v);
}

export function otpErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/invalid-phone-number':
      return 'Please enter a valid 10-digit mobile number.';
    case 'auth/invalid-verification-code':
    case 'auth/code-expired':
      return 'OTP is wrong or expired. Send a new OTP.';
    case 'auth/too-many-requests':
    case 'auth/quota-exceeded':
      return 'Too many OTPs. Please wait a little and try again.';
    case 'auth/captcha-check-failed':
      return 'Captcha check failed. Press Send OTP again and tick “I am not a robot”.';
    case 'auth/credential-already-in-use':
    case 'auth/account-exists-with-different-credential':
      return 'This mobile is already used by another login. Sign out and log in with Mobile OTP instead.';
    case 'auth/provider-already-linked':
      return 'A mobile number is already added to this account.';
    case 'auth/operation-not-allowed':
    case 'auth/billing-not-enabled':
      return 'Mobile OTP is not switched on yet (Firebase → Authentication → Phone, Blaze plan).';
    case 'auth/network-request-failed':
      return 'No internet connection.';
    default:
      return (err as Error)?.message || 'Something went wrong.';
  }
}
