import { useEffect, useState } from 'react';

/**
 * Reads the `exp` claim out of the JWT stored in sessionStorage (client-side
 * only, purely for UI feedback — this is NOT a security check; the server
 * independently rejects expired tokens regardless of what this hook shows).
 * Returns remaining seconds until the 30-minute session expires, or null if
 * there's no token / it can't be parsed.
 */
export function useSessionCountdown() {
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    function tick() {
      const token = sessionStorage.getItem('token');
      if (!token) {
        setRemaining(null);
        return;
      }
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const secondsLeft = Math.floor(payload.exp - Date.now() / 1000);
        setRemaining(secondsLeft > 0 ? secondsLeft : 0);
      } catch {
        setRemaining(null);
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return remaining;
}
