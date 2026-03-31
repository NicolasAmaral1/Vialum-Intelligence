import { describe, it, expect } from 'vitest';
import { parseDefinitionYaml } from '../definition-parser.js';

const minimalYaml = `
slug: test-workflow
name: Test Workflow
version: 1
stages:
  - id: stage1
    name: Stage 1
    position: 1
    tasks:
      - id: task1
        name: Task 1
        position: 1
        steps:
          - id: step1
            name: Step 1
            position: 1
            executor: ai
`;

describe('parseDefinitionYaml', () => {
  it('parses minimal valid YAML', () => {
    const def = parseDefinitionYaml(minimalYaml);
    expect(def.slug).toBe('test-workflow');
    expect(def.name).toBe('Test Workflow');
    expect(def.stages).toHaveLength(1);
    expect(def.stages[0].tasks).toHaveLength(1);
    expect(def.stages[0].tasks[0].steps).toHaveLength(1);
    expect(def.stages[0].tasks[0].steps[0].executor).toBe('ai');
  });

  it('parses complete YAML with all fields', () => {
    const yaml = `
slug: full
name: Full Workflow
version: 2
dataSchema:
  type: object
  required: [marca]
  properties:
    marca: { type: string }
stages:
  - id: s1
    name: Stage 1
    position: 1
    clickupStatus: solicitar dados
    tasks:
      - id: t1
        name: Task 1
        position: 1
        steps:
          - id: step_ai
            name: AI Step
            position: 1
            executor: ai
            adapterType: squad
            promptTemplate: "Analyze {{marca}}"
            allowCheckpoints: true
            inputSchema:
              type: object
              properties:
                marca: { "$ref": "$.clientData.marca" }
            outputSchema:
              type: object
              required: [result]
              properties:
                result: { type: string }
            transitions:
              - condition: "$.output.result == 'ok'"
                target: step_human
              - default: true
                target: step_human
          - id: step_human
            name: Human Step
            position: 2
            executor: human
            assigneeRole: operador
            timeoutMs: 86400000
            onTimeout: step_ai
            followUp:
              intervals: [1440, 4320]
              message: "Pending review"
    `;
    const def = parseDefinitionYaml(yaml);
    expect(def.version).toBe(2);
    expect(def.dataSchema).toBeDefined();
    const step = def.stages[0].tasks[0].steps[0];
    expect(step.adapterType).toBe('squad');
    expect(step.transitions).toHaveLength(2);
    expect(step.allowCheckpoints).toBe(true);
    const human = def.stages[0].tasks[0].steps[1];
    expect(human.executor).toBe('human');
    expect(human.assigneeRole).toBe('operador');
  });

  it('rejects YAML without slug', () => {
    expect(() => parseDefinitionYaml('name: No Slug\nstages: []')).toThrow(/slug/i);
  });

  it('rejects YAML without stages', () => {
    expect(() => parseDefinitionYaml('slug: x\nname: x')).toThrow(/stage/i);
  });

  it('rejects empty stages array', () => {
    expect(() => parseDefinitionYaml('slug: x\nname: x\nstages: []')).toThrow(/stage/i);
  });

  it('rejects stage without tasks', () => {
    const yaml = `
slug: x
name: x
stages:
  - id: s1
    name: S1
    tasks: []
    `;
    expect(() => parseDefinitionYaml(yaml)).toThrow(/task/i);
  });

  it('rejects task without steps', () => {
    const yaml = `
slug: x
name: x
stages:
  - id: s1
    name: S1
    tasks:
      - id: t1
        name: T1
        steps: []
    `;
    expect(() => parseDefinitionYaml(yaml)).toThrow(/step/i);
  });

  it('rejects step without executor', () => {
    const yaml = `
slug: x
name: x
stages:
  - id: s1
    name: S1
    tasks:
      - id: t1
        name: T1
        steps:
          - id: st1
            name: Step
            position: 1
    `;
    expect(() => parseDefinitionYaml(yaml)).toThrow(/executor/i);
  });

  it('rejects invalid executor', () => {
    const yaml = minimalYaml.replace('executor: ai', 'executor: robot');
    expect(() => parseDefinitionYaml(yaml)).toThrow(/executor/i);
  });

  it('sets default adapterType per executor', () => {
    const yaml = `
slug: x
name: x
stages:
  - id: s1
    name: S1
    tasks:
      - id: t1
        name: T1
        steps:
          - { id: a, name: A, position: 1, executor: ai }
          - { id: b, name: B, position: 2, executor: human }
          - { id: c, name: C, position: 3, executor: system }
          - { id: d, name: D, position: 4, executor: client }
    `;
    const def = parseDefinitionYaml(yaml);
    const steps = def.stages[0].tasks[0].steps;
    expect(steps[0].adapterType).toBe('squad');
    expect(steps[1].adapterType).toBe('human');
    expect(steps[2].adapterType).toBe('script');
    expect(steps[3].adapterType).toBe('wait');
  });

  it('explicit adapterType overrides default', () => {
    const yaml = minimalYaml.replace('executor: ai', 'executor: ai\n            adapterType: sdk');
    const def = parseDefinitionYaml(yaml);
    expect(def.stages[0].tasks[0].steps[0].adapterType).toBe('sdk');
  });

  it('rejects transition to nonexistent target', () => {
    const yaml = `
slug: x
name: x
stages:
  - id: s1
    name: S1
    tasks:
      - id: t1
        name: T1
        steps:
          - id: st1
            name: Step
            position: 1
            executor: ai
            transitions:
              - target: nonexistent
    `;
    expect(() => parseDefinitionYaml(yaml)).toThrow(/nonexistent/i);
  });

  it('accepts transition to step in another stage', () => {
    const yaml = `
slug: x
name: x
stages:
  - id: s1
    name: S1
    tasks:
      - id: t1
        name: T1
        steps:
          - id: st1
            name: Step 1
            executor: ai
            transitions:
              - target: st2
  - id: s2
    name: S2
    tasks:
      - id: t2
        name: T2
        steps:
          - id: st2
            name: Step 2
            executor: human
    `;
    const def = parseDefinitionYaml(yaml);
    expect(def.stages[0].tasks[0].steps[0].transitions![0].target).toBe('st2');
  });

  it('uses index as default position', () => {
    const yaml = `
slug: x
name: x
stages:
  - id: s1
    name: S1
    tasks:
      - id: t1
        name: T1
        steps:
          - { id: a, name: A, executor: ai }
          - { id: b, name: B, executor: human }
    `;
    const def = parseDefinitionYaml(yaml);
    expect(def.stages[0].position).toBe(1);
    expect(def.stages[0].tasks[0].steps[0].position).toBe(1);
    expect(def.stages[0].tasks[0].steps[1].position).toBe(2);
  });
});
