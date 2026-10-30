jest.mock('./dotenv', () => ({
  envFilesData: {}
}));

import { buildManifest } from './manifest';

describe('extension manifest hardening', () => {
  it('limits MV3 keepalive content script injection to the top frame', () => {
    const manifest = buildManifest('chrome');
    const keepaliveScript = manifest.content_scripts?.find(script =>
      script.js?.includes('scripts/keepBackgroundWorkerAlive.js')
    );

    expect(keepaliveScript).toBeDefined();
    expect(keepaliveScript?.all_frames).toBe(false);
    expect(keepaliveScript).not.toHaveProperty('match_about_blank');
    expect(keepaliveScript).not.toHaveProperty('match_origin_as_fallback');
  });

  it('uses the tightened MV2 extension CSP', () => {
    const manifest = buildManifest('firefox');
    const csp = manifest.content_security_policy;

    expect(csp).toBe("script-src 'self' 'wasm-unsafe-eval'; object-src 'self'");
    expect(String(csp)).not.toContain("'unsafe-eval'");
    expect(String(csp)).not.toContain('blob:');
  });

  it('declares the data Firefox users must consent to', () => {
    const manifest = buildManifest('firefox') as { browser_specific_settings?: { gecko?: Record<string, unknown> } };

    expect(manifest.browser_specific_settings?.gecko?.data_collection_permissions).toEqual({
      required: ['financialAndPaymentInfo']
    });
  });

  it('grants the Mavryk API hosts only to browsers with random extension origins', () => {
    const apiHosts = ['https://wallet.mavryk.network/*', 'https://basenet.wallet.mavryk.network/*'];
    const hostsOf = (vendor: string) => {
      const manifest = buildManifest(vendor) as { permissions?: string[]; host_permissions?: string[] };
      return [...(manifest.permissions ?? []), ...(manifest.host_permissions ?? [])].filter(p => p.includes('mavryk'));
    };

    expect(hostsOf('firefox')).toEqual(apiHosts);
    expect(hostsOf('safari')).toEqual(apiHosts);
    expect(hostsOf('chrome')).toEqual([]);
    expect(hostsOf('opera')).toEqual([]);
  });

  it('requires Firefox versions with built-in data consent', () => {
    const manifest = buildManifest('firefox') as {
      browser_specific_settings?: { gecko?: Record<string, unknown>; gecko_android?: Record<string, unknown> };
    };

    expect(manifest.browser_specific_settings?.gecko?.strict_min_version).toBe('140.0');
    expect(manifest.browser_specific_settings?.gecko_android?.strict_min_version).toBe('142.0');
  });
});
