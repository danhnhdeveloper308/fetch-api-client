import { FetchApiError, InterceptorManager, RequestInterceptor, ResponseInterceptor } from './types';

/**
 * Generic interceptor manager implementation
 */
class InterceptorManagerImpl<T> implements InterceptorManager<T> {
  private interceptors: Map<number, T> = new Map();
  private nextId = 0;

  /**
   * Add an interceptor and return its ID
   */
  use(interceptor: T): number {
    const id = this.nextId++;
    this.interceptors.set(id, interceptor);
    return id;
  }

  /**
   * Remove an interceptor by ID
   */
  eject(id: number): void {
    this.interceptors.delete(id);
  }

  /**
   * Clear all interceptors
   */
  clear(): void {
    this.interceptors.clear();
  }

  /**
   * Get all interceptors as an array
   */
  getInterceptors(): T[] {
    return Array.from(this.interceptors.values());
  }
}

/**
 * Request interceptor manager
 */
export class RequestInterceptorManager extends InterceptorManagerImpl<RequestInterceptor> {
  /**
   * Execute all request interceptors in sequence
   */
  async execute(config: import('./types').RequestConfig): Promise<import('./types').RequestConfig> {
    let processedConfig = config;
    
    for (const interceptor of this.getInterceptors()) {
      try {
        processedConfig = await interceptor(processedConfig);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown interceptor error';
        console.warn('Request interceptor failed:', errorMessage);
      }
    }
    
    return processedConfig;
  }
}

/**
 * Response interceptor manager
 */
export class ResponseInterceptorManager extends InterceptorManagerImpl<ResponseInterceptor> {
  /**
   * Execute fulfilled interceptors
   */
  async executeFulfilled<T>(response: import('./types').ApiResponse<T>): Promise<import('./types').ApiResponse<T>> {
    let processedResponse = response;
    
    for (const interceptor of this.getInterceptors()) {
      if (interceptor.onFulfilled) {
        try {
          processedResponse = await interceptor.onFulfilled(processedResponse);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown interceptor error';
          console.warn('Response interceptor (fulfilled) failed:', errorMessage);
        }
      }
    }
    
    return processedResponse;
  }

  /**
   * Execute rejected interceptors
   */
  async executeRejected(error: FetchApiError): Promise<FetchApiError> {
    let processedError = error;
    
    for (const interceptor of this.getInterceptors()) {
      if (interceptor.onRejected) {
        try {
          processedError = await interceptor.onRejected(processedError);
        } catch (interceptorError: unknown) {
          const errorMessage = interceptorError instanceof Error ? interceptorError.message : 'Unknown interceptor error';
          console.warn('Response interceptor (rejected) failed:', errorMessage);
        }
      }
    }
    
    return processedError;
  }
}
