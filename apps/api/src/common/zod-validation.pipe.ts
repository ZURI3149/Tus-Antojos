import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import type { ValidationIssue } from '@tus-antojos/shared';
import { z, type ZodType } from 'zod';
import { AppException } from './app-exception.js';

// Mensajes de validación en español para toda la API.
z.config(z.locales.es());

/**
 * Valida body/query/params con un esquema Zod (normalmente de @tus-antojos/shared)
 * y entrega los datos ya parseados. Uso: `@Body(new ZodValidationPipe(schema))`.
 */
export class ZodValidationPipe<T extends ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown, _metadata: ArgumentMetadata): z.output<T> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
      path: issue.path.length > 0 ? issue.path.map(String).join('.') : '(raíz)',
      message: issue.message,
    }));
    throw new AppException('VALIDATION_ERROR', undefined, issues);
  }
}
