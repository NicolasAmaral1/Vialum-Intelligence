import { describe, it, expect } from 'vitest';
import { parseLine, TranscriptParser } from '../transcript-parser.js';

describe('parseLine', () => {
  it('parses system init', () => {
    const result = parseLine('{"type":"system","session_id":"abc-123","model":"claude-sonnet"}');
    expect(result).not.toBeNull();
    expect(result!.entry.kind).toBe('init');
    if (result!.entry.kind === 'init') {
      expect(result!.entry.sessionId).toBe('abc-123');
      expect(result!.entry.model).toBe('claude-sonnet');
    }
    expect(result!.capturedSessionId).toBe('abc-123');
    expect(result!.isSignificant).toBe(true);
  });

  it('parses assistant message', () => {
    const result = parseLine('{"type":"assistant","message":{"content":[{"type":"text","text":"Olá Carlos"}]}}');
    expect(result!.entry.kind).toBe('message');
    if (result!.entry.kind === 'message') expect(result!.entry.text).toBe('Olá Carlos');
    expect(result!.isSignificant).toBe(true);
  });

  it('parses thinking block', () => {
    const result = parseLine('{"type":"assistant","message":{"content":[{"type":"thinking","text":"Let me analyze..."}]}}');
    expect(result!.entry.kind).toBe('thinking');
    expect(result!.isSignificant).toBe(false);
  });

  it('parses tool_use', () => {
    const result = parseLine('{"type":"tool_use","tool_name":"Bash","tool_input":"ls -la"}');
    expect(result!.entry.kind).toBe('tool_call');
    if (result!.entry.kind === 'tool_call') {
      expect(result!.entry.name).toBe('Bash');
      expect(result!.entry.input).toBe('ls -la');
    }
    expect(result!.isSignificant).toBe(true);
  });

  it('parses tool_result', () => {
    const result = parseLine('{"type":"tool_result","tool_name":"Bash","tool_result":"file.txt"}');
    expect(result!.entry.kind).toBe('tool_result');
    if (result!.entry.kind === 'tool_result') {
      expect(result!.entry.name).toBe('Bash');
      expect(result!.entry.content).toBe('file.txt');
      expect(result!.entry.truncated).toBe(false);
    }
  });

  it('parses result with cost', () => {
    const result = parseLine('{"type":"result","usage":{"input_tokens":100,"output_tokens":50},"cost_usd":0.01}');
    expect(result!.entry.kind).toBe('cost');
    if (result!.entry.kind === 'cost') {
      expect(result!.entry.inputTokens).toBe(100);
      expect(result!.entry.outputTokens).toBe(50);
      expect(result!.entry.costUsd).toBe(0.01);
    }
    expect(result!.isSignificant).toBe(true);
  });

  it('parses error', () => {
    const result = parseLine('{"type":"error","error":"something broke"}');
    expect(result!.entry.kind).toBe('error');
    if (result!.entry.kind === 'error') expect(result!.entry.message).toBe('something broke');
  });

  it('marks Read as not significant', () => {
    const result = parseLine('{"type":"tool_use","tool_name":"Read","tool_input":"/file.txt"}');
    expect(result!.isSignificant).toBe(false);
  });

  it('marks Glob as not significant', () => {
    const result = parseLine('{"type":"tool_use","tool_name":"Glob","tool_input":"*.ts"}');
    expect(result!.isSignificant).toBe(false);
  });

  it('marks Grep as not significant', () => {
    const result = parseLine('{"type":"tool_result","tool_name":"Grep","tool_result":"match"}');
    expect(result!.isSignificant).toBe(false);
  });

  it('marks MCP tools as significant', () => {
    const result = parseLine('{"type":"tool_use","tool_name":"mcp__switch__process","tool_input":"{}"}');
    expect(result!.isSignificant).toBe(true);
  });

  it('truncates long tool_result', () => {
    const longContent = 'x'.repeat(5000);
    const result = parseLine(`{"type":"tool_result","tool_name":"Bash","tool_result":"${longContent}"}`);
    if (result!.entry.kind === 'tool_result') {
      expect(result!.entry.content.length).toBeLessThan(5000);
      expect(result!.entry.truncated).toBe(true);
    }
  });

  it('returns null for invalid JSON', () => {
    expect(parseLine('not json at all')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseLine('')).toBeNull();
  });
});

describe('TranscriptParser (buffered)', () => {
  it('feeds complete line', () => {
    const parser = new TranscriptParser();
    const results = parser.feed('{"type":"system","session_id":"x"}\n');
    expect(results).toHaveLength(1);
    expect(results[0].entry.kind).toBe('init');
  });

  it('buffers incomplete line', () => {
    const parser = new TranscriptParser();
    const results = parser.feed('{"type":"sys');
    expect(results).toHaveLength(0);
  });

  it('completes buffered line on next feed', () => {
    const parser = new TranscriptParser();
    parser.feed('{"type":"system","session_id"');
    const results = parser.feed(':"abc"}\n');
    expect(results).toHaveLength(1);
    expect(results[0].capturedSessionId).toBe('abc');
  });

  it('handles multiple lines in one feed', () => {
    const parser = new TranscriptParser();
    const results = parser.feed(
      '{"type":"system","session_id":"x"}\n{"type":"assistant","message":{"content":[{"type":"text","text":"hi"}]}}\n'
    );
    expect(results).toHaveLength(2);
    expect(results[0].entry.kind).toBe('init');
    expect(results[1].entry.kind).toBe('message');
  });

  it('flush returns remaining buffer', () => {
    const parser = new TranscriptParser();
    parser.feed('{"type":"system","session_id":"flush-test"}');
    const results = parser.flush();
    expect(results).toHaveLength(1);
    expect(results[0].capturedSessionId).toBe('flush-test');
  });
});
