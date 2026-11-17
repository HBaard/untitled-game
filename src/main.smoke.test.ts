// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';

/** Canvas context stub that accepts any drawing call. */
const fakeContext = () =>
  new Proxy({}, { get: (t: Record<string, unknown>, k: string) => (k in t ? t[k] : () => undefined), set: (t, k, v) => ((t[k as string] = v), true) });

describe('main page wiring', () => {
  beforeAll(async () => {
    const html = readFileSync('index.html', 'utf8');
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(fakeContext as never);
    await import('./main');
  });

  it('renders the status line and sizes the canvas', () => {
    expect(document.querySelector('#status')!.textContent).toMatch(/LIGHT to move/);
    expect(document.querySelector<HTMLCanvasElement>('#board')!.width).toBe(576);
  });
});
