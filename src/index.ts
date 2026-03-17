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
  QueryParamValue,
} from './types';

// Export FetchApiError class (value export, not type-only)
export { FetchApiError } from './types';

// Export interceptor managers
export { RequestInterceptorManager, ResponseInterceptorManager } from './interceptors';

// Create a default client instance for convenience
import { createClient } from './client';
export const defaultClient = createClient();

// Export methods from default client for direct usage.
// Methods are explicitly bound to preserve correct `this` context.
export const get = defaultClient.get.bind(defaultClient);
export const post = defaultClient.post.bind(defaultClient);
export const put = defaultClient.put.bind(defaultClient);
export const del = defaultClient.delete.bind(defaultClient);
export const patch = defaultClient.patch.bind(defaultClient);
export const head = defaultClient.head.bind(defaultClient);
export const options = defaultClient.options.bind(defaultClient);
export const request = defaultClient.request.bind(defaultClient);
