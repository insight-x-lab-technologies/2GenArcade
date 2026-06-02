// Vitest setup: jsdom + minimal polyfills used by tests.
// Keep this lean — game/audio code is unit-tested against logic, not the DOM.

// matchMedia is referenced by reduced-motion checks.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
