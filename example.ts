import { createClient, defaultClient, ApiResponse } from './src';

// Example 1: Using default client
async function basicUsage() {
  try {
    // Simple GET request
    const response = await defaultClient.get<{ id: number; name: string }>('/users/1');
    console.log('User:', response.data);

    // POST request with data
    const newUser = await defaultClient.post<{ id: number }>('/users', {
      name: 'John Doe',
      email: 'john@example.com'
    });
    console.log('Created user ID:', newUser.data.id);

  } catch (error) {
    console.error('Request failed:', error);
  }
}

// Example 2: Creating custom client with configuration
async function customClientUsage() {
  const apiClient = createClient({
    baseURL: 'https://api.example.com',
    timeout: 10000,
    headers: {
      'X-API-Key': 'your-api-key',
    },
    getToken: async () => {
      // Get token from localStorage, cookies, or any async source
      return localStorage.getItem('authToken');
    },
  });

  try {
    const users = await apiClient.get<User[]>('/users', {
      params: { page: 1, limit: 10 }
    });
    console.log('Users:', users.data);
  } catch (error) {
    console.error('Failed to fetch users:', error);
  }
}

// Example 3: Using interceptors
async function interceptorUsage() {
  const client = createClient({
    baseURL: 'https://api.example.com'
  });

  // Request interceptor - add timestamp to all requests
  client.interceptors.request.use((config) => {
    config.headers = {
      ...config.headers,
      'X-Request-Time': new Date().toISOString(),
    };
    console.log('Sending request to:', config.url);
    return config;
  });

  // Response interceptor - log all responses
  client.interceptors.response.use({
    onFulfilled: (response) => {
      console.log(`Response ${response.status}:`, response.data);
      return response;
    },
    onRejected: (error) => {
      console.error('Request failed:', error.message);
      // Transform error if needed
      if (error.status === 401) {
        // Redirect to login or refresh token
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
      return error;
    }
  });

  try {
    const data = await client.get('/protected-endpoint');
    console.log('Protected data:', data.data);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example 4: Different content types
async function contentTypeExamples() {
  const client = createClient({ baseURL: 'https://api.example.com' });

  try {
    // JSON request (default)
    await client.post('/api/users', { name: 'John' });

    // Form data
    const formData = new FormData();
    formData.append('file', new Blob(['content']), 'file.txt');
    formData.append('description', 'File upload');
    
    await client.post('/api/upload', formData);

    // URL encoded form
    await client.post('/api/form', 
      { username: 'john', password: 'secret' },
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
  } catch (error) {
    console.error('Content type example failed:', error);
  }
}

// Example 5: Error handling
async function errorHandlingExample() {
  const client = createClient({
    baseURL: 'https://api.example.com',
    validateStatus: (status) => status < 500, // Don't throw on 4xx errors
  });

  try {
    const response = await client.get('/might-fail');
    
    if (response.status === 404) {
      console.log('Resource not found');
    } else {
      console.log('Success:', response.data);
    }
  } catch (error) {
    if (error.code === 'NETWORK_ERROR') {
      console.log('Network issue, please check your connection');
    } else if (error.code === 'HTTP_500') {
      console.log('Server error, please try again later');
    } else {
      console.log('Unknown error:', error.message);
    }
  }
}

// Example 6: Timeout and abort signal
async function timeoutExample() {
  const client = createClient();
  const controller = new AbortController();

  // Auto-cancel after 5 seconds
  setTimeout(() => controller.abort(), 5000);

  try {
    const response = await client.get('/slow-endpoint', {
      timeout: 3000, // 3 second timeout
      signal: controller.signal, // Manual abort signal
    });
    console.log('Response:', response.data);
  } catch (error) {
    if (error.message === 'Request Timeout') {
      console.log('Request timed out');
    } else {
      console.log('Request was aborted');
    }
  }
}

// Type definitions for examples
interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

// Run examples
async function runExamples() {
  console.log('Running API Client Examples...');
  
  await basicUsage();
  await customClientUsage();
  await interceptorUsage();
  await contentTypeExamples();
  await errorHandlingExample();
  await timeoutExample();
  
  console.log('Examples completed!');
}

// Uncomment to run examples
// runExamples().catch(console.error);
