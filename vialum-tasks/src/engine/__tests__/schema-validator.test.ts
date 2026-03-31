import { describe, it, expect } from 'vitest';
import { validateSchema, tryValidateSchema } from '../schema-validator.js';

describe('validateSchema', () => {
  it('validates correct object against schema', () => {
    const schema = { type: 'object', properties: { tipo: { type: 'string' } } };
    expect(() => validateSchema({ tipo: 'PF' }, schema)).not.toThrow();
  });

  it('rejects missing required field', () => {
    const schema = { type: 'object', required: ['tipo'], properties: { tipo: { type: 'string' } } };
    expect(() => validateSchema({}, schema)).toThrow(/validation failed/i);
  });

  it('rejects wrong type', () => {
    const schema = { type: 'object', properties: { tipo: { type: 'string' } } };
    // ajv with coerceTypes will convert number to string, so use a stricter test
    const strict = { type: 'object', properties: { items: { type: 'array' } } };
    expect(() => validateSchema({ items: 'not-array' }, strict)).toThrow();
  });

  it('accepts empty object against permissive schema', () => {
    expect(() => validateSchema({}, { type: 'object' })).not.toThrow();
  });

  it('coerces types when possible', () => {
    const schema = { type: 'object', properties: { count: { type: 'number' } } };
    expect(() => validateSchema({ count: '5' }, schema)).not.toThrow();
  });
});

describe('tryValidateSchema', () => {
  it('returns valid:true for correct data', () => {
    const schema = { type: 'object', required: ['x'], properties: { x: { type: 'string' } } };
    const result = tryValidateSchema({ x: 'hello' }, schema);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid:false with errors for invalid data', () => {
    const schema = { type: 'object', required: ['x'], properties: { x: { type: 'string' } } };
    const result = tryValidateSchema({}, schema);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
