/**
 * HTTP methods supported by the API client
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * Query parameters for URL
 */
export type QueryParams = Record<string, string | number | boolean | null | undefined>;

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
  code: string;
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
  onRejected?: (error: ApiError) => ApiError | Promise<ApiError>;
}

/**
 * Generic interceptor manager interface
 */
export interface InterceptorManager<T> {
  use(interceptor: T): number;
  eject(id: number): void;
  clear(): void;
}
