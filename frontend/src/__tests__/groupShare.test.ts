import { describe, it, expect } from 'vitest';
import { linkDoGrupy, tekstZaproszeniaDoGrupy } from '@/lib/groupShare';

describe('linkDoGrupy', () => {
  it('strips www. from the origin (kanonicznyOrigin) so login redirects stay on the allow-list', () => {
    const link = linkDoGrupy('ABC123', undefined, 'https://www.bojo.pl');
    expect(link).toBe('https://bojo.pl/g/ABC123');
  });

  it('appends ?od=<uuid> when an inviter is given', () => {
    const link = linkDoGrupy('ABC123', 'user-42', 'https://bojo.pl');
    expect(link).toBe('https://bojo.pl/g/ABC123?od=user-42');
  });

  it('omits ?od= when no inviter is given', () => {
    const link = linkDoGrupy('ABC123', undefined, 'https://bojo.pl');
    expect(link).not.toContain('?od=');
  });
});

describe('tekstZaproszeniaDoGrupy', () => {
  const grupa = { name: 'Czwartkowa Gierka' };
  const link = 'https://bojo.pl/g/ABC123';

  it('mentions the group name and the link', () => {
    const t = tekstZaproszeniaDoGrupy(grupa, link);
    expect(t).toContain('Czwartkowa Gierka');
    expect(t).toContain(link);
  });

  it('says wprost that an account is required', () => {
    const t = tekstZaproszeniaDoGrupy(grupa, link);
    expect(t).toMatch(/zakładasz konto/i);
  });

  it('does not promise SMS, push notifications, or rankings', () => {
    const t = tekstZaproszeniaDoGrupy(grupa, link);
    expect(t.toLowerCase()).not.toMatch(/sms|push|ranking/);
  });

  it('signs with the inviter name when given', () => {
    const t = tekstZaproszeniaDoGrupy(grupa, link, 'Marek Nowak');
    expect(t).toContain('Marek Nowak zaprasza Cię');
  });

  it('does not claim a specific person invites when no inviter is given', () => {
    const t = tekstZaproszeniaDoGrupy(grupa, link);
    expect(t).not.toMatch(/zaprasza Cię\./); // no dangling "X zaprasza Cię." without a name
    expect(t).toContain('Zapraszamy Cię');
  });

  it('survives a group with no upcoming match — no dangling date line', () => {
    const t = tekstZaproszeniaDoGrupy(grupa, link);
    expect(t).not.toContain('Najbliższy mecz');
  });

  it('includes the next match date and venue when given', () => {
    const t = tekstZaproszeniaDoGrupy(grupa, link, undefined, {
      date: '2026-08-20', time: '18:00:00', fieldName: 'Orlik Winogrady',
    });
    expect(t).toContain('Najbliższy mecz');
    expect(t).toContain('Orlik Winogrady');
    expect(t).toContain('18:00');
  });
});
