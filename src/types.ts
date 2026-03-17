/**
 * HTTP methods supported by the API client
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * Query parameters for URL - supports scalar values and arrays for repeated params
 */
export type QueryParamValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryParamValue | QueryParamValue[]>;

/**
 * Request configuration interface
 */
export interface RequestConfig {
  url?: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  data?: any;
  params?: QueryParams;
  timeout?: number;
  signal?: AbortSignal;
  withCredentials?: boolean;
  validateStatus?: (status: number) => boolean;
  /** Number of times to retry on failure (default: 0) */
  retries?: number;
  /** Delay in ms between retries, or a function returning delay per attempt (default: 0) */
  retryDelay?: number | ((attempt: number) => number);
  /** Predicate to decide whether to retry on a given error (default: retries on NETWORK_ERROR and TIMEOUT) */
  retryOn?: (error: FetchApiError) => boolean;
}

/**
 * Client configuration interface
 */
export interface ClientConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  getToken?: () => string | null | Promise<string | null>;
  withCredentials?: boolean;
  validateStatus?: (status: number) => boolean;
  /** Number of times to retry on failure (default: 0) */
  retries?: number;
  /** Delay in ms between retries, or a function returning delay per attempt (default: 0) */
  retryDelay?: number | ((attempt: number) => number);
  /** Predicate to decide whether to retry on a given error (default: retries on NETWORK_ERROR and TIMEOUT) */
  retryOn?: (error: FetchApiError) => boolean;
}

/**
 * Standardized API response interface
 */
export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  config: RequestConfig;
}

/**
 * Standardized API error interface
 */
export interface ApiError {
  message: string;
  status?: number;
  statusText?: string;
  data?: any;
  config?: RequestConfig;
  /** Error code: HTTP_<status>, NETWORK_ERROR, TIMEOUT, ABORTED, or UNKNOWN_ERROR */
  code: string;
}

/**
 * Error class for API errors - supports instanceof checks and proper stack traces
 */
export class FetchApiError extends Error implements ApiError {
  readonly status?: number;
  readonly statusText?: string;
  readonly data?: any;
  readonly config?: RequestConfig;
  readonly code: string;

  constructor(apiError: ApiError) {
    super(apiError.message);
    this.name = 'FetchApiError';
    this.status = apiError.status;
    this.statusText = apiError.statusText;
    this.data = apiError.data;
    this.config = apiError.config;
    this.code = apiError.code;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FetchApiError);
    }
  }
}

/**
 * Request interceptor function type
 */
export type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;

/**
 * Response interceptor interface
 */
export interface ResponseInterceptor {
  onFulfilled?: <T>(response: ApiResponse<T>) => ApiResponse<T> | Promise<ApiResponse<T>>;
  onRejected?: (error: FetchApiError) => FetchApiError | Promise<FetchApiError>;
}

/**
 * Generic interceptor manager interface
 */
export interface InterceptorManager<T> {
  use(interceptor: T): number;
  eject(id: number): void;
  clear(): void;
}
