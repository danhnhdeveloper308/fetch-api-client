# Fetch API Client

A lightweight TypeScript API client using fetch with an axios-like interface. Perfect for modern web applications, Next.js projects, and Node.js applications.

## Features

- 🚀 **Lightweight**: Zero dependencies, only uses native fetch
- 📦 **TypeScript**: Full TypeScript support with excellent type inference
- 🔄 **Interceptors**: Request and response interceptors like axios
- ⚡ **Modern**: ESM and CommonJS support, tree-shakable
- 🛡️ **Robust**: Built-in error handling, timeout support, and request cancellation
- 🔁 **Retry**: Configurable automatic retry with custom delay and predicate
- 🎯 **Flexible**: Supports all HTTP methods, content types, and array query params
- 🌐 **Universal**: Works in browsers, Node.js, and edge environments

## Installation

```bash
npm install fetch-api-client
```

## Quick Start

```typescript
import { createClient, defaultClient, FetchApiError } from 'fetch-api-client';

// Use default client
const response = await defaultClient.get<User>('/users/1');

// Or create custom client
const api = createClient({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'X-API-Key': 'your-api-key'
  }
});

const users = await api.get<User[]>('/users');
```

## API Reference

### Client Methods

- `get<T>(url, config?): Promise<ApiResponse<T>>`
- `post<T>(url, data?, config?): Promise<ApiResponse<T>>`
- `put<T>(url, data?, config?): Promise<ApiResponse<T>>`
- `delete<T>(url, config?): Promise<ApiResponse<T>>`
- `patch<T>(url, data?, config?): Promise<ApiResponse<T>>`
- `head<T>(url, config?): Promise<ApiResponse<T>>`
- `options<T>(url, config?): Promise<ApiResponse<T>>`
- `request<T>(config): Promise<ApiResponse<T>>`

### Configuration

```typescript
interface ClientConfig {
  baseURL?: string;
  timeout?: number;                                   // default: 30000
  headers?: Record<string, string>;
  getToken?: () => string | null | Promise<string | null>;
  withCredentials?: boolean;
  validateStatus?: (status: number) => boolean;       // default: 200-299
  retries?: number;                                   // default: 0
  retryDelay?: number | ((attempt: number) => number);// default: 0
  retryOn?: (error: FetchApiError) => boolean;        // default: NETWORK_ERROR | TIMEOUT
}
```

### Error Handling

Errors thrown are instances of `FetchApiError` (extends `Error`) with the following codes:

| Code | Meaning |
|------|---------|
| `HTTP_<status>` | HTTP error response (e.g. `HTTP_404`, `HTTP_500`) |
| `NETWORK_ERROR` | Network-level failure (no response received) |
| `TIMEOUT` | Request exceeded the configured timeout |
| `ABORTED` | Request was cancelled via `AbortSignal` |
| `UNKNOWN_ERROR` | Unexpected error |

```typescript
try {
  const response = await api.get('/data');
} catch (error) {
  if (error instanceof FetchApiError) {
    switch (error.code) {
      case 'TIMEOUT':      console.log('Request timed out'); break;
      case 'NETWORK_ERROR': console.log('No network'); break;
      case 'HTTP_401':     console.log('Unauthorized'); break;
    }
  }
}
```

### Retry

```typescript
const api = createClient({
  baseURL: 'https://api.example.com',
  retries: 3,
  retryDelay: (attempt) => attempt * 500, // 500ms, 1000ms, 1500ms
  retryOn: (error) => error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT',
});
```

### Interceptors

```typescript
// Request interceptor
api.interceptors.request.use((config) => {
  config.headers = { ...config.headers, 'X-Timestamp': new Date().toISOString() };
  return config;
});

// Response interceptor
api.interceptors.response.use({
  onFulfilled: (response) => {
    console.log('Response received:', response.status);
    return response;
  },
  onRejected: (error) => {
    if (error.status === 401) {
      // Handle authentication error
    }
    return error;
  }
});
```

### Query Parameters (with array support)

```typescript
// Scalar params: /users?page=1&limit=10
api.get('/users', { params: { page: 1, limit: 10 } });

// Array params: /search?tags=a&tags=b&tags=c
api.get('/search', { params: { tags: ['a', 'b', 'c'] } });
```

### Timeout and AbortSignal

Both a per-request `timeout` and an external `signal` can be used simultaneously — the request aborts on whichever fires first.

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);

const response = await api.get('/slow-endpoint', {
  timeout: 3000,          // fires at 3s
  signal: controller.signal, // fires at 5s
});
```

## Examples

Check the [example.ts](./example.ts) file for comprehensive usage examples.

## License

MIT © [Hoang Danh](https://github.com/hoangdanh2000)
