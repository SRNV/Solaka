import { useState, useEffect } from 'react';

export function useBackendHealth() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: any;
    let aborted = false;

    async function check() {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          if (!aborted) setIsReady(true);
        } else {
          // Status 503 or other non-ok
          if (!aborted) {
            setError('Le serveur se prépare...');
            timer = setTimeout(check, 2000);
          }
        }
      } catch (err) {
        if (!aborted) {
          setError('Connexion au serveur impossible...');
          timer = setTimeout(check, 2000);
        }
      }
    }

    check();

    return () => {
      aborted = true;
      clearTimeout(timer);
    };
  }, []);

  return { isReady, error };
}
