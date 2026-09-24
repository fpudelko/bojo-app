import { describe, it, expect } from 'vitest';
import { turniejIdZeSciezki } from '@/app/api/turniej-media/_wspolne';

describe('turniejIdZeSciezki', () => {
  it('wyciąga UUID turnieju z poprawnej ścieżki galerii', () => {
    expect(turniejIdZeSciezki('turnieje/11111111-1111-4111-8111-111111111111/galeria/a.png'))
      .toBe('11111111-1111-4111-8111-111111111111');
  });

  it('wyciąga UUID turnieju z poprawnej ścieżki sponsorów', () => {
    expect(turniejIdZeSciezki('turnieje/11111111-1111-4111-8111-111111111111/sponsorzy/a.png'))
      .toBe('11111111-1111-4111-8111-111111111111');
  });

  it('odrzuca ścieżkę bez segmentu "turnieje"', () => {
    expect(turniejIdZeSciezki('cokolwiek/11111111-1111-4111-8111-111111111111/a.png')).toBeNull();
  });

  it('odrzuca drugi segment, który nie jest UUID-em — próba wyjścia poza własny turniej', () => {
    expect(turniejIdZeSciezki('turnieje/../../inny-turniej/galeria/a.png')).toBeNull();
    expect(turniejIdZeSciezki('turnieje/nie-uuid/galeria/a.png')).toBeNull();
  });
});
