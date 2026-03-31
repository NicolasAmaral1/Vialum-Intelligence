import { describe, it, expect } from 'vitest';
import { ContextBus } from '../context-bus.js';

describe('ContextBus', () => {
  describe('create', () => {
    it('creates with clientData', () => {
      const bus = ContextBus.create('wf1', 'acc1', { marca: 'Café Bonito', cliente: 'Carlos' });
      const snap = bus.getSnapshot();
      expect(snap.clientData.marca).toBe('Café Bonito');
      expect(snap.clientData.cliente).toBe('Carlos');
      expect(Object.keys(snap.stepOutputs)).toHaveLength(0);
    });

    it('creates with refs', () => {
      const bus = ContextBus.create('wf1', 'acc1', {}, { contactPhone: '+5511999' });
      const snap = bus.getSnapshot();
      expect(snap.refs.contactPhone).toBe('+5511999');
      expect(snap.refs.hubContactId).toBeNull();
    });
  });

  describe('writeOutput', () => {
    it('stores data', () => {
      const bus = ContextBus.create('wf1', 'acc1', {});
      bus.writeOutput('classificar', { tipo: 'nominativa', confidence: 0.95 });
      expect(bus.getSnapshot().stepOutputs.classificar.tipo).toBe('nominativa');
    });

    it('validates against schema', () => {
      const bus = ContextBus.create('wf1', 'acc1', {});
      const schema = { type: 'object', required: ['tipo'], properties: { tipo: { type: 'string' } } };
      bus.writeOutput('s1', { tipo: 'PF' }, schema);
      expect(() => bus.writeOutput('s2', { other: 'value' }, schema)).toThrow();
    });

    it('accepts without schema', () => {
      const bus = ContextBus.create('wf1', 'acc1', {});
      expect(() => bus.writeOutput('x', { any: 'data' })).not.toThrow();
    });
  });

  describe('resolveInput', () => {
    it('resolves $ref paths', () => {
      const bus = ContextBus.create('wf1', 'acc1', { marca: 'Café Bonito' });
      bus.writeOutput('classificar', { tipo: 'nominativa' });
      const input = bus.resolveInput({
        type: 'object',
        properties: {
          marca: { $ref: '$.clientData.marca' },
          tipo: { $ref: '$.stepOutputs.classificar.tipo' },
        },
      });
      expect(input.marca).toBe('Café Bonito');
      expect(input.tipo).toBe('nominativa');
    });

    it('resolves deep nested $ref', () => {
      const bus = ContextBus.create('wf1', 'acc1', {});
      bus.writeOutput('step1', { dados: { endereco: { rua: 'Av Brasil' } } });
      const input = bus.resolveInput({
        type: 'object',
        properties: { rua: { $ref: '$.stepOutputs.step1.dados.endereco.rua' } },
      });
      expect(input.rua).toBe('Av Brasil');
    });

    it('returns undefined for missing ref', () => {
      const bus = ContextBus.create('wf1', 'acc1', {});
      const input = bus.resolveInput({
        type: 'object',
        properties: { missing: { $ref: '$.stepOutputs.nonexistent.field' } },
      });
      expect(input.missing).toBeUndefined();
    });

    it('returns empty object for null schema', () => {
      const bus = ContextBus.create('wf1', 'acc1', { a: 1 });
      expect(bus.resolveInput(null)).toEqual({});
      expect(bus.resolveInput(undefined)).toEqual({});
    });

    it('resolves refs from refs', () => {
      const bus = ContextBus.create('wf1', 'acc1', {}, { contactPhone: '+5511' });
      const input = bus.resolveInput({
        type: 'object',
        properties: { phone: { $ref: '$.refs.contactPhone' } },
      });
      expect(input.phone).toBe('+5511');
    });
  });

  describe('renderPrompt', () => {
    it('renders clientData shorthand', () => {
      const bus = ContextBus.create('wf1', 'acc1', { marca: 'Café Bonito', cliente: 'Carlos' });
      expect(bus.renderPrompt('Registrar {{marca}} para {{cliente}}')).toBe('Registrar Café Bonito para Carlos');
    });

    it('renders full path', () => {
      const bus = ContextBus.create('wf1', 'acc1', {});
      bus.writeOutput('step1', { mensagem: 'Olá!' });
      expect(bus.renderPrompt('Enviar: {{stepOutputs.step1.mensagem}}')).toBe('Enviar: Olá!');
    });

    it('renders variables', () => {
      const bus = ContextBus.create('wf1', 'acc1', {});
      bus.setVariable('tentativa', 2);
      expect(bus.renderPrompt('Tentativa {{tentativa}}')).toBe('Tentativa 2');
    });

    it('replaces missing with empty string', () => {
      const bus = ContextBus.create('wf1', 'acc1', {});
      expect(bus.renderPrompt('Hello {{missing}}!')).toBe('Hello !');
    });
  });

  describe('variables', () => {
    it('set and get', () => {
      const bus = ContextBus.create('wf1', 'acc1', {});
      bus.setVariable('count', 3);
      expect(bus.get('variables.count')).toBe(3);
    });
  });

  describe('setRef', () => {
    it('updates ref value', () => {
      const bus = ContextBus.create('wf1', 'acc1', {});
      bus.setRef('externalTaskId', '123');
      expect(bus.getSnapshot().refs.externalTaskId).toBe('123');
    });
  });

  describe('persist and hydrate', () => {
    it('round-trips correctly', () => {
      const bus = ContextBus.create('wf1', 'acc1', { marca: 'Teste' }, { contactPhone: '+55' });
      bus.writeOutput('step1', { ok: true });
      bus.setVariable('count', 3);

      const json = bus.persist();
      const bus2 = ContextBus.hydrate(json);
      const snap = bus2.getSnapshot();

      expect(snap.clientData.marca).toBe('Teste');
      expect(snap.stepOutputs.step1.ok).toBe(true);
      expect(snap.variables.count).toBe(3);
      expect(snap.refs.contactPhone).toBe('+55');
    });

    it('handles missing fields gracefully', () => {
      const bus = ContextBus.hydrate({ workflowId: 'x', accountId: 'y' } as any);
      const snap = bus.getSnapshot();
      expect(snap.stepOutputs).toBeDefined();
      expect(snap.variables).toBeDefined();
      expect(snap.refs.contactPhone).toBeNull();
    });

    it('persist is deep clone', () => {
      const bus = ContextBus.create('wf1', 'acc1', { x: 1 });
      const json1 = bus.persist();
      bus.writeOutput('s1', { y: 2 });
      const json2 = bus.persist();
      expect((json1 as any).stepOutputs).toEqual({});
      expect((json2 as any).stepOutputs.s1.y).toBe(2);
    });
  });

  describe('get', () => {
    it('resolves deep path', () => {
      const bus = ContextBus.create('wf1', 'acc1', { nested: { deep: 42 } });
      expect(bus.get('clientData.nested.deep')).toBe(42);
    });
  });
});
