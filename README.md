# Fetch API Client

A lightweight TypeScript API client using fetch with an axios-like interface. Perfect for modern web applications, Next.js projects, and Node.js applications.

## Features

- 🚀 **Lightweight**: Zero dependencies, only uses native fetch
- 📦 **TypeScript**: Full TypeScript support with excellent type inference
- 🔄 **Interceptors**: Request and response interceptors like axios
- ⚡ **Modern**: ESM and CommonJS support, tree-shakable
- 🛡️ **Robust**: Built-in error handling, timeout support, and request cancellation
- 🎯 **Flexible**: Supports all HTTP methods and content types
- 🌐 **Universal**: Works in browsers, Node.js, and edge environments

## Installation

```bash
npm install @hoangdanh2000/fetch-api-client
```

## Quick Start

```typescript
import { createClient, defaultClient } from '@hoangdanh2000/fetch-api-client';

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
  timeout?: number;
  headers?: Record<string, string>;
  getToken?: () => string | null | Promise<string | null>;
  withCredentials?: boolean;
  validateStatus?: (status: number) => boolean;
}
```

### Interceptors

```typescript
// Request interceptor
api.interceptors.request.use((config) => {
  config.headers['X-Timestamp'] = new Date().toISOString();
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

## Examples

Check the [example.ts](./example.ts) file for comprehensive usage examples.

## License

MIT © [Hoang Danh](https://github.com/hoangdanh2000)
