import { describe, it, expect, vi } from 'vitest';
import { createPlaybackManager, type PlaybackDeps } from './speech';

function setup(over: Partial<PlaybackDeps> = {}) {
  let t = 1000;
  const stops: string[] = [];
  const ended: Record<string, () => void> = {};
  const played: string[] = [];
  const deps: PlaybackDeps = {
    now: () => t,
    resolveSettings: async () => ({ engine: 'piper' as never, voiceId: 'v', voicePref: 'auto' as never }),
    neuralAvailable: () => true,
    synth: vi.fn(async (text: string) => `url:${text}`),
    play: vi.fn(async (url: string, onEnded: () => void) => {
      played.push(url);
      ended[url] = onEnded;
      return { stop: () => stops.push(url) };
    }),
    speakBrowser: vi.fn(),
    cancelBrowser: vi.fn(),
    ...over,
  };
  return { deps, played, stops, ended, advance: (ms: number) => (t += ms), mgr: createPlaybackManager(deps) };
}

describe('playback manager', () => {
  it('dedupes identical requests within 800ms', async () => {
    const s = setup();
    await Promise.all([s.mgr.speak('hola'), s.mgr.speak('hola')]);
    await s.mgr.speak('hola');
    expect(s.played).toEqual(['url:hola']);
    s.advance(900);
    await s.mgr.speak('hola');
    expect(s.played).toHaveLength(2);
  });

  it('explicit click replays after previous playback ended, but not while active', async () => {
    const s = setup();
    await s.mgr.speak('hola');
    await s.mgr.speak('hola', { explicit: true });
    expect(s.played).toHaveLength(1);
    s.ended['url:hola']();
    s.advance(100);
    await s.mgr.speak('hola', { explicit: true });
    expect(s.played).toHaveLength(2);
  });

  it('drops stale requests and stops the previous playback', async () => {
    let release!: (u: string) => void;
    const s = setup({
      synth: vi.fn((text: string) =>
        text === 'uno' ? new Promise<string>((r) => (release = r)) : Promise.resolve(`url:${text}`),
      ),
    });
    const first = s.mgr.speak('uno');
    await Promise.resolve();
    await s.mgr.speak('dos');
    release('url:uno');
    await first;
    expect(s.played).toEqual(['url:dos']);
    expect(s.deps.speakBrowser).not.toHaveBeenCalled();
  });

  it('stops current audio when a new request starts', async () => {
    const s = setup();
    await s.mgr.speak('uno');
    await s.mgr.speak('dos');
    expect(s.stops).toEqual(['url:uno']);
    expect(s.deps.cancelBrowser).toHaveBeenCalledTimes(2);
  });

  it('falls back only when synthesis fails, never in addition to audio', async () => {
    const bad = setup({ synth: vi.fn(async () => { throw new Error('x'); }) });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await bad.mgr.speak('hola');
    expect(bad.deps.speakBrowser).toHaveBeenCalledTimes(1);
    expect(bad.played).toHaveLength(0);

    const good = setup();
    await good.mgr.speak('hola');
    expect(good.deps.speakBrowser).not.toHaveBeenCalled();
  });

  it('stale failure does not trigger fallback', async () => {
    let fail!: (e: Error) => void;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = setup({
      synth: vi.fn((text: string) =>
        text === 'uno' ? new Promise<string>((_, r) => (fail = r)) : Promise.resolve(`url:${text}`),
      ),
    });
    const first = s.mgr.speak('uno');
    await Promise.resolve();
    await s.mgr.speak('dos');
    fail(new Error('late'));
    await first;
    expect(s.deps.speakBrowser).not.toHaveBeenCalled();
    expect(s.played).toEqual(['url:dos']);
  });
});
