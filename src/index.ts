// Export main client
export { ApiClient, createClient } from './client';

// Export all types
export type {
  HttpMethod,
  RequestConfig,
  ClientConfig,
  ApiResponse,
  ApiError,
  RequestInterceptor,
  ResponseInterceptor,
  InterceptorManager,
  QueryParams,
} from './types';

// Export interceptor managers
export { RequestInterceptorManager, ResponseInterceptorManager } from './interceptors';

// Create a default client instance for convenience
import { createClient } from './client';
export const defaultClient = createClient();

// Export methods from default client for direct usage
export const { get, post, put, delete: del, patch, head, options, request } = defaultClient;
