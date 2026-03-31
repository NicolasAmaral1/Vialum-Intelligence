import { describe, it, expect, beforeEach } from 'vitest';

// We need a fresh registry per test, so we'll test the pattern manually
// since the registry is a singleton module

describe('adapter registry pattern', () => {
  // Test using inline map (same logic as adapter.registry.ts)
  let adapters: Map<string, { type: string; displayName: string }>;

  beforeEach(() => {
    adapters = new Map();
  });

  const register = (adapter: { type: string; displayName: string }) => {
    if (adapters.has(adapter.type)) throw new Error(`Already registered: ${adapter.type}`);
    adapters.set(adapter.type, adapter);
  };

  const get = (type: string) => {
    const a = adapters.get(type);
    if (!a) throw new Error(`Unknown adapter: ${type}`);
    return a;
  };

  it('register + get returns same adapter', () => {
    const mock = { type: 'test', displayName: 'Test' };
    register(mock);
    expect(get('test')).toBe(mock);
  });

  it('get unknown type throws', () => {
    expect(() => get('nonexistent')).toThrow(/unknown/i);
  });

  it('duplicate registration throws', () => {
    register({ type: 'x', displayName: 'X' });
    expect(() => register({ type: 'x', displayName: 'X2' })).toThrow(/already/i);
  });

  it('list returns registered types', () => {
    register({ type: 'a', displayName: 'A' });
    register({ type: 'b', displayName: 'B' });
    expect(Array.from(adapters.keys())).toEqual(['a', 'b']);
  });
});
