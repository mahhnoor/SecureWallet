import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [username, setUsername] = useState(() =>
    sessionStorage.getItem('username')
  );

  const [profile, setProfile] = useState(null);

  const refreshProfile = useCallback(async () => {
    if (!sessionStorage.getItem('token')) return;

    try {
      const { data } = await client.get('/auth/me');
      setProfile(data);
    } catch {
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const login = useCallback(
    async (usernameInput, password) => {
      try {
        const { data } = await client.post('/auth/login', {
          username: usernameInput,
          password,
        });

        /*
         * MFA-enabled account:
         *
         * The backend has verified the password but deliberately
         * has NOT issued the real session JWT yet.
         */
        if (data.mfaRequired) {
          return {
            ok: true,
            mfaRequired: true,
            mfaChallenge: data.mfaChallenge,
            username: data.user.username,
          };
        }

        // Account without MFA — normal login.
        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('username', data.user.username);

        setUsername(data.user.username);
        refreshProfile();

        return {
          ok: true,
          mfaRequired: false,
        };
      } catch (err) {
        return {
          ok: false,
          error:
            err.response?.data?.error || 'Login failed.',
        };
      }
    },
    [refreshProfile]
  );

  const verifyLoginMfa = useCallback(
    async (mfaChallenge, code) => {
      try {
        const { data } = await client.post(
          '/auth/mfa/verify-login',
          {
            mfaChallenge,
            code,
          }
        );

        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('username', data.user.username);

        setUsername(data.user.username);
        refreshProfile();

        return {
          ok: true,
        };
      } catch (err) {
        return {
          ok: false,
          error:
            err.response?.data?.error ||
            'MFA verification failed.',
        };
      }
    },
    [refreshProfile]
  );

  const register = useCallback(async (payload) => {
    try {
      await client.post('/auth/register', payload);
      return { ok: true };
    } catch (err) {
      const details = err.response?.data?.details;

      const message = details?.length
        ? details.map((d) => d.message).join(' ')
        : err.response?.data?.error ||
          'Registration failed.';

      return {
        ok: false,
        error: message,
      };
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('username');

    setUsername(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        username,
        profile,
        isAuthenticated: !!username,
        login,
        verifyLoginMfa,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      'useAuth must be used within AuthProvider'
    );
  }

  return ctx;
}