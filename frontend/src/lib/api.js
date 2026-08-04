import axios from 'axios';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('struktiva_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('struktiva_token');
      localStorage.removeItem('struktiva_usuario');
      if (location.pathname !== '/login') location.href = '/login';
    }
    return Promise.reject(error);
  }
);
