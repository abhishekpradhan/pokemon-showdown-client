import '@testing-library/jest-dom/vitest';

Object.defineProperty(window, 'scrollTo', {
  value: () => {},
  writable: true,
});

// jsdom ships no matchMedia; the theme resolver needs one.
Object.defineProperty(window, 'matchMedia', {
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }),
  writable: true,
});
