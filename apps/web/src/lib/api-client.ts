import { apiErrorBodySchema, type ApiErrorCode, type ValidationIssue } from '@tus-antojos/shared';

export type ClientErrorCode = ApiErrorCode | 'NETWORK';

/** Error de una llamada a la API, con el formato del spec platform §3.3. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ClientErrorCode,
    message: string,
    readonly details: unknown,
    readonly requestId: string | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Errores por campo (VALIDATION_ERROR), listos para React Hook Form. */
  get fieldErrors(): ValidationIssue[] {
    return Array.isArray(this.details) ? (this.details as ValidationIssue[]) : [];
  }

  /** `details.reason` de un BUSINESS_RULE (p. ej. LAST_ADMIN). */
  get reason(): string | undefined {
    const details = this.details as { reason?: unknown } | undefined;
    return typeof details?.reason === 'string' ? details.reason : undefined;
  }
}

export interface ApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
}

interface ApiClientOptions {
  baseUrl: string;
  /** JWT de la sesión actual (Supabase lo renueva solo). */
  getAccessToken: () => Promise<string | null>;
  /** 401: la sesión ya no sirve → cerrarla (las rutas protegidas llevan a /login). */
  onUnauthorized: () => void;
  /** 403: el usuario no tiene permiso para esa acción. */
  onForbidden: (message: string) => void;
  fetch?: typeof fetch;
}

/** Cliente de la API NestJS: la ÚNICA vía de escritura de la web. */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers = new Headers({ 'x-request-id': crypto.randomUUID() });
    const token = await options.getAccessToken();
    if (token) headers.set('authorization', `Bearer ${token}`);
    if (body !== undefined) headers.set('content-type', 'application/json');

    let response: Response;
    try {
      response = await fetchImpl(`${options.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, 'NETWORK', 'No se pudo conectar con el servidor', undefined, null);
    }

    const text = await response.text();
    const data: unknown = text ? safeJson(text) : undefined;

    if (response.ok) return data as T;

    const parsed = apiErrorBodySchema.safeParse(data);
    const error = parsed.success
      ? new ApiError(
          response.status,
          parsed.data.error.code,
          parsed.data.error.message,
          parsed.data.error.details,
          parsed.data.error.requestId,
        )
      : new ApiError(
          response.status,
          'INTERNAL',
          'Error del servidor. Inténtalo de nuevo.',
          undefined,
          response.headers.get('x-request-id'),
        );

    if (response.status === 401) options.onUnauthorized();
    if (response.status === 403) options.onForbidden(error.message);
    throw error;
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
