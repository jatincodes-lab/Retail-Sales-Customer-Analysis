import { useCallback, useEffect, useRef, useState } from 'react';

export default function useActionLoading() {
  const activeRef = useRef(new Set());
  const mountedRef = useRef(true);
  const [activeKeys, setActiveKeys] = useState(() => new Set());

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const run = useCallback((key, action) => async (...args) => {
    if (activeRef.current.has(key)) return;
    activeRef.current.add(key);
    if (mountedRef.current) setActiveKeys(previous => new Set(previous).add(key));
    try {
      return await action(...args);
    } finally {
      activeRef.current.delete(key);
      if (mountedRef.current) {
        setActiveKeys(previous => {
          const next = new Set(previous);
          next.delete(key);
          return next;
        });
      }
    }
  }, []);

  const isLoading = useCallback(key => activeKeys.has(key), [activeKeys]);
  return { run, isLoading };
}
