import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, coerceTypes: true });

/**
 * Validate data against a JSON Schema.
 * Throws if invalid.
 */
export function validateSchema(
  data: Record<string, unknown>,
  schema: Record<string, unknown>,
): void {
  const validate = ajv.compile(schema);
  if (!validate(data)) {
    const errors = validate.errors
      ?.map((e) => `${e.instancePath || '/'} ${e.message}`)
      .join('; ');
    throw new Error(`Schema validation failed: ${errors}`);
  }
}

/**
 * Validate data against a JSON Schema.
 * Returns { valid, errors } without throwing.
 */
export function tryValidateSchema(
  data: Record<string, unknown>,
  schema: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
  const validate = ajv.compile(schema);
  const valid = validate(data) as boolean;
  const errors = valid
    ? []
    : (validate.errors?.map((e) => `${e.instancePath || '/'} ${e.message}`) ?? []);
  return { valid, errors };
}
