// API utilities con ofuscación
import { getRandomHeaders, randomDelay, encodeStr } from './obfuscation';

// Paths de API ofuscados
const API_PATHS = {
  user: encodeStr('/api/user'),
  sms: encodeStr('/api/sms'),
  sessions: encodeStr('/api/sessions'),
  keys: encodeStr('/api/keys'),
  notifications: encodeStr('/api/notifications')
};

export const getApiPath = (key: keyof typeof API_PATHS): string => {
  return atob(API_PATHS[key].split('').reverse().join(''));
};

// Request wrapper con anti-detección
export const secureRequest = async (url: string, options: RequestInit = {}): Promise<Response> => {
  // Delay aleatorio antes del request
  await randomDelay(50, 150);
  
  const headers = {
    ...getRandomHeaders(),
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  // Agregar noise headers aleatorios
  const noiseHeaders = {
    'X-Request-ID': Math.random().toString(36).substring(7),
    'X-Client-Version': '2.1.3',
    'X-Timestamp': Date.now().toString()
  };
  
  return fetch(url, {
    ...options,
    headers: { ...headers, ...noiseHeaders }
  });
};

// Wrapper para requests con retry y ofuscación
export const apiRequest = async (endpoint: string, options: RequestInit = {}, retries: number = 3): Promise<any> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await secureRequest(endpoint, options);
      
      if (!response.ok) {
        if (i === retries - 1) {
          throw new Error(`Request failed: ${response.status}`);
        }
        await randomDelay(1000, 2000);
        continue;
      }
      
      return await response.json();
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }
      await randomDelay(1000, 2000);
    }
  }
};