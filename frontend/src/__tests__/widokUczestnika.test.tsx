import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useWidokUczestnika } from '@/lib/widokUczestnika';

// Przełącznik „Organizator / Uczestnik” (2026-11-22): wybór pamiętany na
// urządzeniu i wspólny dla otwartych kart (strona turnieju, strona meczu).
afterEach(() => { cleanup(); window.localStorage.clear(); });

describe('useWidokUczestnika', () => {
  it('domyślnie widok organizatora, przełączenie pamięta się i dociera do innych użyć', () => {
    const a = renderHook(() => useWidokUczestnika());
    const b = renderHook(() => useWidokUczestnika());
    expect(a.result.current[0]).toBe(false);
    act(() => a.result.current[1](true));
    expect(a.result.current[0]).toBe(true);
    expect(b.result.current[0]).toBe(true);
    expect(window.localStorage.getItem('bojo-widok-uczestnika')).toBe('1');
    act(() => b.result.current[1](false));
    expect(a.result.current[0]).toBe(false);
  });
});
