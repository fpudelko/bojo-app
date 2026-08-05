'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Shared "hide the bottom nav" mechanism for BottomNavGate. A counter, not a
// boolean: two independent reasons to hide (a route like the wizard, plus a
// page-state condition like "not in the squad yet") must not un-hide the nav
// just because one of them unmounts while the other is still active.
const Ctx = createContext<{ hidden: boolean; register: () => () => void }>({
  hidden: false,
  register: () => () => {},
});

export function BottomNavVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const register = useCallback(() => {
    setCount((c) => c + 1);
    return () => setCount((c) => c - 1);
  }, []);
  const value = useMemo(() => ({ hidden: count > 0, register }), [count, register]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBottomNavHidden() {
  return useContext(Ctx).hidden;
}

/**
 * Mount this anywhere to hide the bottom nav for as long as it stays mounted.
 * A component, not a hook — call sites need to gate it behind a condition
 * computed after other hooks (e.g. derived participation state on the event
 * page), and a conditionally-called hook would break React's hook order.
 */
export function HideBottomNav() {
  const { register } = useContext(Ctx);
  useEffect(() => register(), [register]);
  return null;
}
