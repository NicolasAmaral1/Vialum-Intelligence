'use client';
import { useState } from 'react';

interface JsonSchemaProperty {
  type: string;
  enum?: string[];
  description?: string;
  default?: unknown;
}

interface Props {
  schema: {
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
  };
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

export function DynamicForm({ schema, values, onChange }: Props) {
  const properties = schema.properties || {};
  const required = new Set(schema.required || []);

  const updateField = (key: string, value: string) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div className="space-y-3">
      {Object.entries(properties).map(([key, prop]) => (
        <div key={key}>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {formatLabel(key)}
            {required.has(key) && <span className="text-danger ml-0.5">*</span>}
          </label>

          {prop.enum ? (
            <select
              value={String(values[key] ?? prop.default ?? '')}
              onChange={(e) => updateField(key, e.target.value)}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              <option value="">Selecione...</option>
              {prop.enum.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input
              type={prop.type === 'number' ? 'number' : 'text'}
              value={String(values[key] ?? '')}
              onChange={(e) => updateField(key, e.target.value)}
              placeholder={prop.description || ''}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          )}

          {prop.description && !prop.enum && (
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">{prop.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}
