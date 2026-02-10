import '@testing-library/jest-dom';

// Mock window.matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => { },
        removeListener: () => { },
        addEventListener: () => { },
        removeEventListener: () => { },
        dispatchEvent: () => false,
    }),
});

// Mock crypto for password hashing tests
Object.defineProperty(globalThis, 'crypto', {
    value: {
        getRandomValues: (arr: Uint8Array) => {
            for (let i = 0; i < arr.length; i++) {
                arr[i] = Math.floor(Math.random() * 256);
            }
            return arr;
        },
        subtle: {
            digest: async (_algorithm: string, data: ArrayBuffer) => {
                // Simple mock hash for testing
                const view = new Uint8Array(data);
                const hash = new Uint8Array(32);
                for (let i = 0; i < view.length; i++) {
                    hash[i % 32] ^= view[i];
                }
                return hash.buffer;
            },
        },
    },
});
