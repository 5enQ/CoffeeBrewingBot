// Modules that touch the platform layer expect browser globals; minimal stubs are enough for data tests.
const g = globalThis as Record<string, unknown>;
g.window ??= globalThis;
g.location ??= new URL('https://example.com/');
g.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
g.document ??= { documentElement: {}, addEventListener() {}, removeEventListener() {} };
g.addEventListener ??= () => {};
g.removeEventListener ??= () => {};
g.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
