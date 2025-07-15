import { 
  ClientConfig, 
  RequestConfig, 
  ApiResponse, 
  ApiError, 
  HttpMethod,
  QueryParams 
} from './types';
import { RequestInterceptorManager, ResponseInterceptorManager } from './interceptors';

/**
 * Type guard to check if error is a fetch TypeError
 */
function isFetchTypeError(error: unknown): error is TypeError {
  return error instanceof TypeError && typeof (error as TypeError).message === 'string';
}

/**
 * Type guard to check if error is an AbortError
 */
function isAbortError(error: unknown): error is Error {
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * Type guard to check if error is our custom ApiError
 */
function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && 
         error !== null && 
         'status' in error && 
         'message' in error;
}

/**
 * Main API Client class that provides axios-like interface using fetch
 */
export class ApiClient {
  private config: Required<ClientConfig>;
  public interceptors: {
    request: RequestInterceptorManager;
    response: ResponseInterceptorManager;
  };

  constructor(config: ClientConfig = {}) {
    // Set default configuration
    this.config = {
      baseURL: '',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      getToken: () => null,
      withCredentials: false,
      validateStatus: (status: number) => status >= 200 && status < 300,
      ...config,
    };

    // Initialize interceptor managers
    this.interceptors = {
      request: new RequestInterceptorManager(),
      response: new ResponseInterceptorManager(),
    };
  }

  /**
   * Build complete URL from base URL and endpoint
   */
  private buildUrl(url: string, params?: QueryParams): string {
    const fullUrl = url.startsWith('http') ? url : `${this.config.baseURL}${url}`;
    
    if (!params) return fullUrl;

    const urlObj = new URL(fullUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        urlObj.searchParams.append(key, String(value));
      }
    });

    return urlObj.toString();
  }

  /**
   * Prepare headers for the request
   */
  private async prepareHeaders(config: RequestConfig): Promise<Headers> {
    const headers = new Headers();

    // Add default headers
    Object.entries(this.config.headers).forEach(([key, value]) => {
      headers.set(key, value);
    });

    // Add request-specific headers
    if (config.headers) {
      Object.entries(config.headers).forEach(([key, value]) => {
        headers.set(key, value);
      });
    }

    // Add authorization token if available
    try {
      const token = await this.config.getToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    } catch (error) {
      console.warn('Failed to get token:', error);
    }

    return headers;
  }

  /**
   * Prepare request body
   */
  private prepareBody(data: any, headers: Headers): string | FormData | null {
    if (!data) return null;

    const contentType = headers.get('Content-Type');

    if (data instanceof FormData) {
      // Remove Content-Type header for FormData to let browser set it
      headers.delete('Content-Type');
      return data;
    }

    if (contentType?.includes('application/json')) {
      return JSON.stringify(data);
    }

    if (contentType?.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams();
      Object.entries(data).forEach(([key, value]) => {
        params.append(key, String(value));
      });
      return params.toString();
    }

    return String(data);
  }

  /**
   * Create AbortController with timeout
   */
  private createAbortController(timeout?: number): AbortController {
    const controller = new AbortController();
    const timeoutMs = timeout ?? this.config.timeout;

    if (timeoutMs > 0) {
      setTimeout(() => {
        controller.abort();
      }, timeoutMs);
    }

    return controller;
  }

  /**
   * Parse response based on content type
   */
  private async parseResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('Content-Type') || '';

    if (contentType.includes('application/json')) {
      return response.json();
    }

    if (contentType.includes('text/')) {
      return response.text();
    }

    if (contentType.includes('application/octet-stream') || contentType.includes('image/')) {
      return response.blob();
    }

    return response.text();
  }

  /**
   * Create standardized error object
   */
  private createError(
    message: string,
    status?: number,
    statusText?: string,
    data?: any,
    config?: RequestConfig
  ): ApiError {
    return {
      message,
      status,
      statusText,
      data,
      config,
      code: status ? `HTTP_${status}` : 'NETWORK_ERROR',
    };
  }

  /**
   * Core request method
   */
  async request<T = any>(config: RequestConfig): Promise<ApiResponse<T>> {
    try {
      // Process request through interceptors
      const processedConfig = await this.interceptors.request.execute(config);

      // Prepare request components
      const url = this.buildUrl(processedConfig.url || '', processedConfig.params);
      const headers = await this.prepareHeaders(processedConfig);
      const body = this.prepareBody(processedConfig.data, headers);
      const controller = processedConfig.signal ? 
        { signal: processedConfig.signal } : 
        this.createAbortController(processedConfig.timeout);

      // Execute fetch request
      const response = await fetch(url, {
        method: processedConfig.method || 'GET',
        headers,
        body,
        credentials: this.config.withCredentials ? 'include' : 'same-origin',
        ...controller,
      });

      // Parse response data
      const data = await this.parseResponse(response);

      // Check if response status is valid
      if (!this.config.validateStatus(response.status)) {
        const error = this.createError(
          `Request failed with status ${response.status}`,
          response.status,
          response.statusText,
          data,
          processedConfig
        );
        
        const processedError = await this.interceptors.response.executeRejected(error);
        throw processedError;
      }

      // Create successful response
      const apiResponse: ApiResponse<T> = {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        config: processedConfig,
      };

      // Process response through interceptors
      return await this.interceptors.response.executeFulfilled(apiResponse);

    } catch (error: unknown) {
      // Handle different types of errors with proper type checking
      if (isFetchTypeError(error) && error.message.includes('fetch')) {
        const networkError = this.createError('Network Error', undefined, undefined, undefined, config);
        const processedError = await this.interceptors.response.executeRejected(networkError);
        throw processedError;
      }

      if (isAbortError(error)) {
        const timeoutError = this.createError('Request Timeout', undefined, undefined, undefined, config);
        const processedError = await this.interceptors.response.executeRejected(timeoutError);
        throw processedError;
      }

      // Re-throw if it's already our custom error
      if (isApiError(error)) {
        throw error;
      }

      // Create generic error for unknown error types
      const errorMessage = error instanceof Error ? error.message : 'Unknown Error';
      const genericError = this.createError(
        errorMessage,
        undefined,
        undefined,
        undefined,
        config
      );
      const processedError = await this.interceptors.response.executeRejected(genericError);
      throw processedError;
    }
  }

  /**
   * GET request
   */
  async get<T = any>(url: string, config?: Omit<RequestConfig, 'method' | 'url'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  /**
   * POST request
   */
  async post<T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'method' | 'url' | 'data'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  /**
   * PUT request
   */
  async put<T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'method' | 'url' | 'data'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  /**
   * DELETE request
   */
  async delete<T = any>(url: string, config?: Omit<RequestConfig, 'method' | 'url'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }

  /**
   * PATCH request
   */
  async patch<T = any>(url: string, data?: any, config?: Omit<RequestConfig, 'method' | 'url' | 'data'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'PATCH', url, data });
  }

  /**
   * HEAD request
   */
  async head<T = any>(url: string, config?: Omit<RequestConfig, 'method' | 'url'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'HEAD', url });
  }

  /**
   * OPTIONS request
   */
  async options<T = any>(url: string, config?: Omit<RequestConfig, 'method' | 'url'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'OPTIONS', url });
  }
}

/**
 * Create a new API client instance
 */
export function createClient(config?: ClientConfig): ApiClient {
  return new ApiClient(config);
}
