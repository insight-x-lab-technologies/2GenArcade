import { describe, it, expect } from 'vitest';
import { buildShareTarget, SHARE_NETWORKS, SHARE_LABELS } from './share';

const MSG = 'Play 2GenArcade!';
const URL = 'https://example.com/2GenArcade/';

describe('buildShareTarget', () => {
  it('covers every network in the bar with a label', () => {
    for (const network of SHARE_NETWORKS) {
      expect(SHARE_LABELS[network]).toBeTruthy();
      const target = buildShareTarget(network, MSG, URL);
      expect(target.href.length).toBeGreaterThan(0);
    }
  });

  it('url-encodes the message and link into intent URLs', () => {
    const wa = buildShareTarget('whatsapp', MSG, URL);
    expect(wa.copyFirst).toBe(false);
    expect(wa.href).toContain(encodeURIComponent(`${MSG} ${URL}`));

    const x = buildShareTarget('x', MSG, URL);
    expect(x.href).toContain(encodeURIComponent(MSG));
    expect(x.href).toContain(encodeURIComponent(URL));

    const fb = buildShareTarget('facebook', MSG, URL);
    expect(fb.href).toContain(encodeURIComponent(URL));
  });

  it('flags networks without a text intent for clipboard fallback', () => {
    expect(buildShareTarget('instagram', MSG, URL).copyFirst).toBe(true);
    expect(buildShareTarget('tiktok', MSG, URL).copyFirst).toBe(true);
    expect(buildShareTarget('whatsapp', MSG, URL).copyFirst).toBe(false);
  });

  it('uses the native scheme for Messenger', () => {
    expect(buildShareTarget('messenger', MSG, URL).href).toMatch(/^fb-messenger:/);
  });
});
