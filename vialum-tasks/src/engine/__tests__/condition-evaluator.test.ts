import { describe, it, expect } from 'vitest';
import { evaluateCondition, evaluateTransitions } from '../condition-evaluator.js';
import type { ContextSnapshot } from '../context-bus.js';

const makeSnapshot = (overrides: Partial<ContextSnapshot> = {}): ContextSnapshot => ({
  workflowId: 'wf1',
  accountId: 'acc1',
  clientData: { tipo: 'PF', marca: 'Café' },
  stepOutputs: {
    step1: { completo: true, tipo: 'PF', faltantes: ['rg', 'cpf'] },
  },
  variables: { tentativa: 2 },
  refs: { contactPhone: null, conversationId: null, hubContactId: null, externalTaskId: null },
  ...overrides,
});

describe('evaluateCondition', () => {
  it('null/undefined/empty returns true', () => {
    expect(evaluateCondition(null, makeSnapshot())).toBe(true);
    expect(evaluateCondition(undefined, makeSnapshot())).toBe(true);
    expect(evaluateCondition('', makeSnapshot())).toBe(true);
    expect(evaluateCondition('  ', makeSnapshot())).toBe(true);
  });

  it('compares string', () => {
    expect(evaluateCondition("$.clientData.tipo == 'PF'", makeSnapshot())).toBe(true);
    expect(evaluateCondition("$.clientData.tipo == 'PJ'", makeSnapshot())).toBe(false);
  });

  it('compares number', () => {
    expect(evaluateCondition('$.variables.tentativa < 3', makeSnapshot())).toBe(true);
    expect(evaluateCondition('$.variables.tentativa >= 3', makeSnapshot())).toBe(false);
  });

  it('accesses stepOutputs', () => {
    expect(evaluateCondition('$.stepOutputs.step1.completo == true', makeSnapshot())).toBe(true);
  });

  it('accesses array length', () => {
    expect(evaluateCondition('$.stepOutputs.step1.faltantes.length > 0', makeSnapshot())).toBe(true);
    expect(evaluateCondition('$.stepOutputs.step1.faltantes.length == 0', makeSnapshot())).toBe(false);
  });

  it('returns false for nonexistent path', () => {
    expect(evaluateCondition("$.stepOutputs.nope.field == 'x'", makeSnapshot())).toBe(false);
  });

  it('returns false for invalid expression', () => {
    expect(evaluateCondition('!!!invalid!!!', makeSnapshot())).toBe(false);
  });
});

describe('evaluateTransitions', () => {
  const snap = makeSnapshot();

  it('first condition match wins', () => {
    const result = evaluateTransitions([
      { condition: "$.clientData.tipo == 'PJ'", target: 'step_pj' },
      { condition: "$.clientData.tipo == 'PF'", target: 'step_pf' },
      { condition: "$.variables.tentativa < 5", target: 'step_other' },
    ], snap, {});
    expect(result).toBe('step_pf');
  });

  it('default as fallback', () => {
    const result = evaluateTransitions([
      { condition: "$.clientData.tipo == 'XX'", target: 'nope' },
      { default: true, target: 'fallback' },
    ], snap, {});
    expect(result).toBe('fallback');
  });

  it('no match no default returns null', () => {
    const result = evaluateTransitions([
      { condition: "$.clientData.tipo == 'XX'", target: 'nope' },
    ], snap, {});
    expect(result).toBeNull();
  });

  it('transition without condition always matches', () => {
    const result = evaluateTransitions([
      { target: 'always' },
    ], snap, {});
    expect(result).toBe('always');
  });

  it('accesses $.output from stepOutput', () => {
    const result = evaluateTransitions([
      { condition: "$.output.resultado == 'ok'", target: 'success' },
      { default: true, target: 'fail' },
    ], snap, { resultado: 'ok' });
    expect(result).toBe('success');
  });
});
