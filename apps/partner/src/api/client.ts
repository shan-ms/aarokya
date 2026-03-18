import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = 'https://api.aarokya.in/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'X-Client': 'aarokya-partner',
  },
});

let authToken: string | null = null;
let refreshTokenValue: string | null = null;
let onTokenRefreshed: ((token: string) => void) | null = null;
let onAuthFailed: (() => void) | null = null;

export const setAuthToken = (token: string | null): void => {
  authToken = token;
};

export const setRefreshToken = (token: string | null): void => {
  refreshTokenValue = token;
};

export const setAuthCallbacks = (callbacks: {
  onTokenRefreshed?: (token: string) => void;
  onAuthFailed?: () => void;
}): void => {
  onTokenRefreshed = callbacks.onTokenRefreshed ?? null;
  onAuthFailed = callbacks.onAuthFailed ?? null;
};

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (authToken && config.headers) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (refreshTokenValue) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken: refreshTokenValue,
          });
          const newToken: string = response.data.data.accessToken;
          authToken = newToken;
          onTokenRefreshed?.(newToken);
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return apiClient(originalRequest);
        } catch {
          onAuthFailed?.();
          return Promise.reject(error);
        }
      } else {
        onAuthFailed?.();
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
