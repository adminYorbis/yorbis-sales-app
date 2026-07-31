import crypto from 'crypto';
import { deterministicFingerprint } from './planning-policies';

const TRACKING = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'fbclid', 'msclkid', 'mc_cid', 'mc_eid',
]);
export function canonicalizePublicUrl(raw: string) {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only public HTTP(S) sources are allowed.');
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  const canonicalUrl = url.toString();
  const domainParts = url.hostname.split('.');
  const registrableDomain = domainParts.slice(-2).join('.');
  return { canonicalUrl, normalizedUrl: canonicalUrl, domain: url.hostname, registrableDomain };
}
export function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
export function boundedExcerpt(value: string, maximum = 2000) {
  return value.trim().slice(0, maximum);
}
export function sourceObservationFingerprint(value: {
  runId: string; sourceId: string; queryId: string; providerResultId?: string | null;
}) {
  return deterministicFingerprint(value);
}
