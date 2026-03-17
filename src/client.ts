import { 
  ClientConfig, 
  RequestConfig, 
  ApiResponse, 
  FetchApiError,
  QueryParams,
  QueryParamValue,
} from './types';
import { RequestInterceptorManager, ResponseInterceptorManager } from './interceptors';

/**
 * Type guard to check if error is already our FetchApiError or structural ApiError
 */
function isApiError(error: unknown): error is FetchApiError {
  return error instanceof FetchApiError || (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

/**
 * Default retry predicate: retry on network errors and timeouts
 */
function defaultRetryOn(error: FetchApiError): boolean {
  return error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT';
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
    this.config = {
      baseURL: '',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      getToken: () => null,
      withCredentials: false,
      validateStatus: (status: number) => status >= 200 && status < 300,
      retries: 0,
      retryDelay: 0,
      retryOn: defaultRetryOn,
      ...config,
    };

    this.interceptors = {
      request: new RequestInterceptorManager(),
      response: new ResponseInterceptorManager(),
    };
  }

  /**
   * Build complete URL from base URL, endpoint, and query params.
   * Works for both absolute and relative URLs.
   */
  private buildUrl(url: string, params?: QueryParams): string {
    const fullUrl = url.startsWith('http') ? url : `${this.config.baseURL}${url}`;

    if (!params) return fullUrl;

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      if (Array.isArray(value)) {
        (value as QueryParamValue[]).forEach(v => {
          if (v !== null && v !== undefined) searchParams.append(key, String(v));
        });
      } else {
        searchParams.append(key, String(value));
      }
    });

    const queryString = searchParams.toString();
    if (!queryString) return fullUrl;
    return fullUrl.includes('?') ? `${fullUrl}&${queryString}` : `${fullUrl}?${queryString}`;
  }

  /**
   * Prepare headers for the request
   */
  private async prepareHeaders(config: RequestConfig): Promise<Headers> {
    const headers = new Headers();

    Object.entries(this.config.headers).forEach(([key, value]) => {
      headers.set(key, value);
    });

    if (config.headers) {
      Object.entries(config.headers).forEach(([key, value]) => {
        headers.set(key, value);
      });
    }

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

    if (data instanceof FormData) {
      headers.delete('Content-Type');
      return data;
    }

    const contentType = headers.get('Content-Type');

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
   * Create an AbortController that fires after `timeout` ms and optionally
   * mirrors an external AbortSignal. Returns the merged signal and a cleanup fn.
   */
  private createAbortController(
    timeout?: number,
    externalSignal?: AbortSignal
  ): { signal: AbortSignal; clear: () => void } {
    const controller = new AbortController();
    const timeoutMs = timeout ?? this.config.timeout;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        controller.abort(new DOMException('Request timed out', 'TimeoutError'));
      }, timeoutMs);
    }

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort(externalSignal.reason);
      } else {
        externalSignal.addEventListener(
          'abort',
          () => controller.abort(externalSignal.reason),
          { once: true }
        );
      }
    }

    return {
      signal: controller.signal,
      clear: () => { if (timeoutId !== undefined) clearTimeout(timeoutId); },
    };
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
   * Create a FetchApiError instance
   */
  private createError(
    message: string,
    status?: number,
    statusText?: string,
    data?: any,
    config?: RequestConfig,
    code?: string
  ): FetchApiError {
    return new FetchApiError({
      message,
      status,
      statusText,
      data,
      config,
      code: code ?? (status ? `HTTP_${status}` : 'NETWORK_ERROR'),
    });
  }

  /**
   * Execute a single fetch attempt (without retry logic)
   */
  private async _executeRequest<T>(config: RequestConfig): Promise<ApiResponse<T>> {
    const processedConfig = await this.interceptors.request.execute(config);

    const url = this.buildUrl(processedConfig.url || '', processedConfig.params);
    const headers = await this.prepareHeaders(processedConfig);
    const body = this.prepareBody(processedConfig.data, headers);
    const { signal, clear } = this.createAbortController(
      processedConfig.timeout,
      processedConfig.signal
    );

    try {
      const response = await fetch(url, {
        method: processedConfig.method || 'GET',
        headers,
        body,
        credentials: (processedConfig.withCredentials ?? this.config.withCredentials) ? 'include' : 'same-origin',
        signal,
      });

      clear();

      const data = await this.parseResponse(response);

      const validateStatus = processedConfig.validateStatus ?? this.config.validateStatus;
      if (!validateStatus(response.status)) {
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

      const apiResponse: ApiResponse<T> = {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        config: processedConfig,
      };

      return await this.interceptors.response.executeFulfilled(apiResponse);

    } catch (error: unknown) {
      clear();

      // Timeout or user-initiated abort
      if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
        const isTimeout = error.name === 'TimeoutError' ||
          (error instanceof DOMException && error.message.includes('timed out'));
        const abortError = this.createError(
          isTimeout ? 'Request Timeout' : 'Request Aborted',
          undefined, undefined, undefined, config,
          isTimeout ? 'TIMEOUT' : 'ABORTED'
        );
        const processedError = await this.interceptors.response.executeRejected(abortError);
        throw processedError;
      }

      // Re-throw if already a processed ApiError
      if (isApiError(error)) {
        throw error;
      }

      // Network-level failure (TypeError from fetch)
      if (error instanceof TypeError) {
        const networkError = this.createError('Network Error', undefined, undefined, undefined, config, 'NETWORK_ERROR');
        const processedError = await this.interceptors.response.executeRejected(networkError);
        throw processedError;
      }

      // Unknown error
      const errorMessage = error instanceof Error ? error.message : 'Unknown Error';
      const genericError = this.createError(errorMessage, undefined, undefined, undefined, config, 'UNKNOWN_ERROR');
      const processedError = await this.interceptors.response.executeRejected(genericError);
      throw processedError;
    }
  }

  /**
   * Core request method with retry support
   */
  async request<T = any>(config: RequestConfig): Promise<ApiResponse<T>> {
    const maxRetries = config.retries ?? this.config.retries;
    const retryDelay = config.retryDelay ?? this.config.retryDelay;
    const retryOn = config.retryOn ?? this.config.retryOn;

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = typeof retryDelay === 'function' ? retryDelay(attempt) : retryDelay;
        if (delay > 0) await new Promise<void>(resolve => setTimeout(resolve, delay));
      }

      try {
        return await this._executeRequest<T>(config);
      } catch (error: unknown) {
        lastError = error;
        if (attempt < maxRetries && isApiError(error) && retryOn(error as FetchApiError)) {
          continue;
        }
        throw error;
      }
    }

    throw lastError;
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
