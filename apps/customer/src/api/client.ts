import { Platform } from 'react-native';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// Android emulator: use 10.0.2.2 to reach host localhost. Override with API_BASE_URL env if set.
const getApiBaseUrl = () => {
  if (process.env.API_BASE_URL) return process.env.API_BASE_URL;
  if (__DEV__ && Platform.OS === 'android') return 'http://10.0.2.2:8080/api/v1';
  return 'https://api.aarokya.in/v1';
};
const API_BASE_URL = getApiBaseUrl();

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

client.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

export default client;
