import axios from 'axios';

// Smart API URL resolution for Local Dev, Docker, Vercel, and Render deployments
const getBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  
  if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // If running in production / deployed domain (HTTPS or remote hostname)
    if (!isLocalhost) {
      // If envUrl is explicitly provided and is a valid HTTPS remote backend
      if (envUrl && typeof envUrl === 'string' && envUrl.startsWith('https://')) {
        return envUrl.trim();
      }
      // Otherwise, use same-origin relative '/api' to avoid Mixed Content and CORS issues
      return '/api';
    }
  }

  // Local development fallback
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim();
  }

  return 'http://localhost:5000/api';
};

const api = axios.create({
  baseURL: getBaseUrl(),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && token !== 'undefined') {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
