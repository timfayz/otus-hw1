import { z } from "zod";
import { ApiHttpError, ApiValidationError } from "./errors";

/** Тип query: выводится из схемы Q, если она передана; без схемы query передать нельзя */
type QueryOf<Q> = Q extends z.ZodType ? z.infer<Q> : undefined;

export interface ApiClientOptions {
  baseURL: string;
  headers?: Record<string, string>;
  maxAttempts?: number;
  baseDelay?: number;
  cacheTtlMs?: number;
}

export interface GetConfig<
  S extends z.ZodType,
  Q extends z.ZodType | undefined = undefined,
> {
  url: string;
  responseSchema: S;
  querySchema?: Q;
  query?: QueryOf<Q>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export class ApiClient {
  private readonly baseURL: string;
  private readonly globalHeaders: Record<string, string>;
  private readonly maxAttempts: number;
  private readonly baseDelay: number;
  private readonly cacheTtlMs: number;
  private readonly cache = new Map<
    string,
    { value: unknown; expiresAt: number }
  >();

  constructor(options: ApiClientOptions) {
    this.baseURL = options.baseURL.replace(/\/+$/, "");
    this.globalHeaders = options.headers ?? {};
    this.maxAttempts = options.maxAttempts ?? 1;
    this.baseDelay = options.baseDelay ?? 500;
    this.cacheTtlMs = options.cacheTtlMs ?? 0;
  }

  /** GET с валидацией; тип ответа выводится из responseSchema */
  async get<S extends z.ZodType, Q extends z.ZodType | undefined = undefined>(
    config: GetConfig<S, Q>,
  ): Promise<z.infer<S>> {
    const { url, responseSchema, querySchema, query, headers, signal } = config;

    let queryString = "";
    if (querySchema && query !== undefined) {
      const parsed = querySchema.safeParse(query);
      if (!parsed.success) {
        throw new ApiValidationError(this.fullUrl(url), parsed.error);
      }
      queryString = toQueryString(parsed.data as Record<string, unknown>);
    }
    const fullUrl = this.fullUrl(url) + (queryString ? `?${queryString}` : "");

    const cached = this.getCached(fullUrl);
    if (cached !== undefined) {
      return cached as z.infer<S>;
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        const data = await this.request(fullUrl, headers, signal);
        const parsed = responseSchema.safeParse(data);
        if (!parsed.success) {
          throw new ApiValidationError(fullUrl, parsed.error);
        }
        this.setCached(fullUrl, parsed.data);
        return parsed.data;
      } catch (error) {
        lastError = error;
        // повтор, если коды ошибки >= 5xx
        const isServerError =
          error instanceof ApiHttpError && error.status >= 500;
        if (isServerError && attempt < this.maxAttempts) {
          await sleep(this.baseDelay * 2 ** (attempt - 1));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  private async request(
    url: string,
    headers?: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const response = await fetch(url, {
      headers: { ...this.globalHeaders, ...headers },
      signal,
    });

    if (!response.ok) {
      let details: unknown;
      try {
        details = await response.json();
      } catch {
        details = undefined;
      }
      throw new ApiHttpError(response.status, url, details);
    }

    return response.json();
  }

  private fullUrl(url: string): string {
    return url.startsWith("http")
      ? url
      : `${this.baseURL}/${url.replace(/^\//, "")}`;
  }

  private getCached(url: string): unknown | undefined {
    const hit = this.cache.get(url);
    if (!hit) return undefined;
    if (Date.now() >= hit.expiresAt) {
      this.cache.delete(url);
      return undefined;
    }
    return hit.value;
  }

  private setCached(url: string, value: unknown): void {
    if (this.cacheTtlMs <= 0) return;
    this.cache.set(url, { value, expiresAt: Date.now() + this.cacheTtlMs });
  }
}

/** { _limit: 3 } -> "_limit=3" */
function toQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.append(key, String(value));
    }
  }
  return search.toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
