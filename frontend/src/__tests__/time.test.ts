import { describe, it, expect } from 'vitest';
import { toMinutes, fromMinutes } from '@/lib/time';

describe('toMinutes', () => {
  it('converts HH:MM to minutes since midnight', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('18:00')).toBe(1080);
    expect(toMinutes('23:59')).toBe(1439);
  });
});

describe('fromMinutes', () => {
  it('converts minutes since midnight back to zero-padded HH:MM', () => {
    expect(fromMinutes(0)).toBe('00:00');
    expect(fromMinutes(1080)).toBe('18:00');
    expect(fromMinutes(65)).toBe('01:05');
  });

  it('round-trips with toMinutes', () => {
    expect(fromMinutes(toMinutes('09:30'))).toBe('09:30');
  });
});
