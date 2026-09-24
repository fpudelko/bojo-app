import { describe, it, expect } from 'vitest';
import { uploadObrazek } from '@/lib/storageUpload';

function plikFake(rozmiar: number, typ: string): File {
  return new File([new Uint8Array(rozmiar)], 'test.png', { type: typ });
}

describe('uploadObrazek — walidacja', () => {
  // Obie asercje odrzucają PRZED siecią (i przed sprawdzeniem sesji), więc nie
  // potrzebują atrapy Supabase ani `fetch`.
  it('odrzuca plik większy niż 5 MB', async () => {
    await expect(uploadObrazek('x', plikFake(5 * 1024 * 1024 + 1, 'image/png')))
      .rejects.toThrow('Maksymalny rozmiar: 5 MB');
  });

  it('odrzuca plik, który nie jest image/*', async () => {
    await expect(uploadObrazek('x', plikFake(100, 'application/pdf')))
      .rejects.toThrow('Tylko pliki graficzne');
  });
});
