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
});
