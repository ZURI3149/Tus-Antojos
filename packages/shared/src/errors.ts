import { z } from 'zod';

/** Códigos de error de la API (spec platform §3.3). */
export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'BUSINESS_RULE',
  'INTERNAL',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const API_ERROR_HTTP_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  BUSINESS_RULE: 422,
  INTERNAL: 500,
} as const satisfies Record<ApiErrorCode, number>;

export const apiErrorCodeSchema = z.enum(API_ERROR_CODES);

export const validationIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export type ValidationIssue = z.infer<typeof validationIssueSchema>;

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    details: z
      .union([z.array(validationIssueSchema), z.record(z.string(), z.unknown())])
      .optional(),
    requestId: z.string().min(1),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
