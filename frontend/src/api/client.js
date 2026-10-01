import axios from 'axios';

const client = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    'http://localhost:4000/api',
});

client.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

client.interceptors.response.use(
  (response) => response,

  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || '';

    /*
     * SEC: 401 responses during authentication are not treated
     * as expired authenticated sessions.
     *
     * Login and MFA verification can legitimately return 401
     * while the user is still in the authentication flow.
     */
    const authenticationRequest =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/mfa/verify-login') ||
      requestUrl.includes('/auth/mfa/verify-setup');

    if (
      status === 401 &&
      sessionStorage.getItem('token') &&
      !authenticationRequest
    ) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('username');

      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default client;