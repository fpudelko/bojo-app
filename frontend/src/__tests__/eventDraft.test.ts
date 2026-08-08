import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadEventDraft,
  saveEventDraft,
  clearEventDraft,
  draftAgeLabel,
  EVENT_DRAFT_TTL_MS,
  type EventDraftValues,
} from '@/lib/eventDraft';

const VALUES: EventDraftValues = {
  sport: 'piłka nożna',
  location: { venue: null, lat: null, lng: null, address: '' },
  date: '2099-01-01',
  time: '18:00',
  durationMin: 90,
  czasWlasny: false,
  maxPlayers: 14,
  maxPlayersTouched: false,
  goalkeepersEnabled: true,
  reserveClaimHours: 3,
  title: '',
  description: '',
  descriptionEnabled: false,
  visibility: 'public',
  requireApproval: false,
  organizerParticipates: true,
  organizerRole: 'field',
  costPln: '',
  kosztZaObiekt: true,
  kosztObiektuPln: '',
  acceptedPaymentMethods: [],
  blikPhone: '',
  cardDiscountEnabled: false,
  cardDiscountPln: '',
  acceptedSportsCards: [],
  sportsCardOtherName: '',
};

beforeEach(() => {
  localStorage.clear();
});

describe('saveEventDraft / loadEventDraft', () => {
  it('round-trips values and step', () => {
    saveEventDraft(2, VALUES);
    const draft = loadEventDraft();
    expect(draft).not.toBeNull();
    expect(draft?.step).toBe(2);
    expect(draft?.values).toEqual(VALUES);
  });

  it('returns null when nothing was saved', () => {
    expect(loadEventDraft()).toBeNull();
  });

  it('returns null for malformed JSON instead of throwing', () => {
    localStorage.setItem('bojo_event_draft_v1', '{not json');
    expect(loadEventDraft()).toBeNull();
  });

  it('returns null for a different schema version', () => {
    localStorage.setItem('bojo_event_draft_v1', JSON.stringify({ v: 2, ts: Date.now(), step: 1, values: VALUES }));
    expect(loadEventDraft()).toBeNull();
  });

  it('returns null once the draft has aged past the TTL', () => {
    const staleTs = Date.now() - EVENT_DRAFT_TTL_MS - 1000;
    localStorage.setItem('bojo_event_draft_v1', JSON.stringify({ v: 1, ts: staleTs, step: 1, values: VALUES }));
    expect(loadEventDraft()).toBeNull();
  });

  it('still returns a draft just under the TTL', () => {
    const freshTs = Date.now() - EVENT_DRAFT_TTL_MS + 1000;
    localStorage.setItem('bojo_event_draft_v1', JSON.stringify({ v: 1, ts: freshTs, step: 1, values: VALUES }));
    expect(loadEventDraft()).not.toBeNull();
  });

  it('wczytuje szkic zapisany PRZED dodaniem nazwy własnej miejsca', () => {
    // Pole `nazwaWlasnaMiejsca` doszło później i jest opcjonalne właśnie po to,
    // żeby nie unieważniać szkiców w toku. Gdyby wersję `v` podbito zamiast tego,
    // każdy formularz wypełniany w chwili wdrożenia poszedłby do kosza.
    const { nazwaWlasnaMiejsca, ...stareValues } = { ...VALUES, nazwaWlasnaMiejsca: 'x' };
    void nazwaWlasnaMiejsca;
    localStorage.setItem(
      'bojo_event_draft_v1',
      JSON.stringify({ v: 1, ts: Date.now(), step: 2, values: stareValues }),
    );
    const draft = loadEventDraft();
    expect(draft).not.toBeNull();
    expect(draft!.values.nazwaWlasnaMiejsca).toBeUndefined();
    expect(draft!.step).toBe(2);
  });

  it('zapisuje i odtwarza nazwę własną miejsca', () => {
    saveEventDraft(1, { ...VALUES, nazwaWlasnaMiejsca: 'Boisko przy szkole' });
    expect(loadEventDraft()!.values.nazwaWlasnaMiejsca).toBe('Boisko przy szkole');
  });

  it('does not throw when localStorage.setItem fails (e.g. private mode)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => saveEventDraft(1, VALUES)).not.toThrow();
    spy.mockRestore();
  });
});

describe('clearEventDraft', () => {
  it('removes a saved draft', () => {
    saveEventDraft(1, VALUES);
    clearEventDraft();
    expect(loadEventDraft()).toBeNull();
  });
});

describe('draftAgeLabel', () => {
  it('reads "przed chwilą" for under a minute', () => {
    expect(draftAgeLabel(Date.now() - 5_000)).toBe('przed chwilą');
  });

  it('reads minutes for under an hour', () => {
    expect(draftAgeLabel(Date.now() - 20 * 60_000)).toBe('20 minut temu');
  });

  it('reads hours past an hour', () => {
    expect(draftAgeLabel(Date.now() - 3 * 3600_000)).toBe('3 godziny temu');
  });
});
