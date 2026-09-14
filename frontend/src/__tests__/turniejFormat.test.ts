import { describe, expect, it } from 'vitest';
import {
  domyslnaLiczbaGrup,
  meczeKazdyZKazdym,
  rozlosujGrupy,
  szacunekCzasu,
  ulozHarmonogram,
  zbudujDrabinke,
  type NowyMecz,
} from '@/lib/turniejFormat';

// ID-y deterministyczne, nie `crypto.randomUUID()` — testy sprawdzają STRUKTURĘ
// (kto z kim, ile rund), nie treść identyfikatorów.
function idFabryka() {
  let n = 0;
  return () => `m${n++}`;
}

describe('domyslnaLiczbaGrup', () => {
  it('nie dzieli małych turniejów', () => {
    expect(domyslnaLiczbaGrup(2)).toBe(1);
    expect(domyslnaLiczbaGrup(4)).toBe(1);
  });

  it('celuje w grupy po 3-4 drużyny', () => {
    expect(domyslnaLiczbaGrup(8)).toBe(2);
    expect(domyslnaLiczbaGrup(12)).toBe(3);
    expect(domyslnaLiczbaGrup(16)).toBe(4);
  });

  it('nigdy nie zejdzie poniżej 3 drużyn w grupie', () => {
    for (let n = 5; n <= 64; n++) {
      const grupy = domyslnaLiczbaGrup(n);
      expect(n / grupy).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('rozlosujGrupy', () => {
  it('rozdziela wszystkie drużyny, nikogo nie gubiąc i nie duplikując', () => {
    const druzyny = Array.from({ length: 11 }, (_, i) => `d${i}`);
    const grupy = rozlosujGrupy(druzyny, 3);
    expect(grupy.flat().sort()).toEqual([...druzyny].sort());
  });

  it('rozmiary grup różnią się co najwyżej o 1', () => {
    const druzyny = Array.from({ length: 11 }, (_, i) => `d${i}`);
    const grupy = rozlosujGrupy(druzyny, 3);
    const rozmiary = grupy.map((g) => g.length);
    expect(Math.max(...rozmiary) - Math.min(...rozmiary)).toBeLessThanOrEqual(1);
  });

  it('z ustalonym RNG podział jest deterministyczny i powtarzalny', () => {
    const druzyny = ['a', 'b', 'c', 'd', 'e', 'f'];
    // losuj() = 0 → Fisher-Yates zawsze zamienia z pozycją 0 (deterministyczny,
    // ale wciąż permutuje) — sprawdzamy powtarzalność, nie brak tasowania.
    const grupy1 = rozlosujGrupy(druzyny, 2, () => 0);
    const grupy2 = rozlosujGrupy(druzyny, 2, () => 0);
    expect(grupy1).toEqual(grupy2);
    expect(grupy1.flat().sort()).toEqual([...druzyny].sort());
  });
});

describe('meczeKazdyZKazdym', () => {
  it('parzysta liczba drużyn: każda para gra dokładnie raz', () => {
    const druzyny = ['a', 'b', 'c', 'd'];
    const mecze = meczeKazdyZKazdym(druzyny, { startNumer: 1, noweId: idFabryka() });
    expect(mecze).toHaveLength(6); // C(4,2)
    const pary = mecze.map((m) => [m.druzynaAId, m.druzynaBId].sort().join('-'));
    expect(new Set(pary).size).toBe(6);
  });

  it('żadna drużyna nie gra dwa razy w tej samej kolejce', () => {
    const druzyny = ['a', 'b', 'c', 'd', 'e', 'f'];
    const mecze = meczeKazdyZKazdym(druzyny, { startNumer: 1, noweId: idFabryka() });
    const poKolejkach = new Map<number, string[]>();
    for (const m of mecze) {
      const lista = poKolejkach.get(m.kolejka!) ?? [];
      lista.push(m.druzynaAId!, m.druzynaBId!);
      poKolejkach.set(m.kolejka!, lista);
    }
    for (const lista of Array.from(poKolejkach.values())) {
      expect(new Set(lista).size).toBe(lista.length);
    }
  });

  it('nieparzysta liczba drużyn: pauza, ale wciąż każdy z każdym', () => {
    const druzyny = ['a', 'b', 'c', 'd', 'e']; // 5 drużyn → C(5,2) = 10 meczów
    const mecze = meczeKazdyZKazdym(druzyny, { startNumer: 1, noweId: idFabryka() });
    expect(mecze).toHaveLength(10);
    const pary = new Set(mecze.map((m) => [m.druzynaAId, m.druzynaBId].sort().join('-')));
    expect(pary.size).toBe(10);
    // 5 rund (n nieparzyste → n rund), każda z jedną drużyną pauzującą (2 mecze/rundę)
    const rundy = new Set(mecze.map((m) => m.kolejka));
    expect(rundy.size).toBe(5);
  });

  it('grupa (nie liga) niesie grupaId i fazę "grupa"', () => {
    const mecze = meczeKazdyZKazdym(['a', 'b', 'c'], { startNumer: 1, grupaId: 'G1', noweId: idFabryka() });
    expect(mecze.every((m) => m.faza === 'grupa' && m.grupaId === 'G1')).toBe(true);
  });

  it('mniej niż 2 drużyny: brak meczów', () => {
    expect(meczeKazdyZKazdym(['a'], { startNumer: 1 })).toEqual([]);
    expect(meczeKazdyZKazdym([], { startNumer: 1 })).toEqual([]);
  });

  it('numeracja meczów zaczyna się od startNumer i rośnie bez dziur', () => {
    const mecze = meczeKazdyZKazdym(['a', 'b', 'c', 'd'], { startNumer: 10, noweId: idFabryka() });
    expect(mecze.map((m) => m.numer)).toEqual([10, 11, 12, 13, 14, 15]);
  });
});

describe('zbudujDrabinke', () => {
  function sprawdzDrabinke(liczbaDruzyn: number) {
    const druzyny = Array.from({ length: liczbaDruzyn }, (_, i) => `d${i}`);
    const mecze = zbudujDrabinke(druzyny, { startNumer: 1, noweId: idFabryka() });

    let rozmiarDrabinki = 1;
    while (rozmiarDrabinki < liczbaDruzyn) rozmiarDrabinki *= 2;
    const oczekiwaneWolneLosy = rozmiarDrabinki - liczbaDruzyn;

    expect(mecze).toHaveLength(rozmiarDrabinki - 1);
    expect(mecze.filter((m) => m.status === 'walkower')).toHaveLength(oczekiwaneWolneLosy);

    // Dokładnie jeden finał, i to ostatni numerem.
    const finaly = mecze.filter((m) => m.faza === 'final');
    expect(finaly).toHaveLength(1);
    expect(finaly[0].numer).toBe(Math.max(...mecze.map((m) => m.numer)));

    // Każdy mecz poza rundą 1 wskazuje na DWA RÓŻNE, istniejące mecze źródłowe.
    const idy = new Set(mecze.map((m) => m.id));
    for (const m of mecze) {
      if (m.kolejka === 1) continue;
      expect(m.zrodloAMeczId).toBeDefined();
      expect(m.zrodloBMeczId).toBeDefined();
      expect(m.zrodloAMeczId).not.toBe(m.zrodloBMeczId);
      expect(idy.has(m.zrodloAMeczId!)).toBe(true);
      expect(idy.has(m.zrodloBMeczId!)).toBe(true);
    }

    // Każda drużyna pojawia się w drabince dokładnie raz (jako A albo B rundy 1).
    const wRundzie1 = mecze.filter((m) => m.kolejka === 1);
    const obsadzeni = wRundzie1.flatMap((m) => [m.druzynaAId, m.druzynaBId]).filter(Boolean);
    expect(obsadzeni.sort()).toEqual([...druzyny].sort());

    // Wolny los ma OD RAZU zwycięzcę = jedyną obecną drużynę.
    for (const m of wRundzie1) {
      if (m.status === 'walkower') {
        const obecna = m.druzynaAId ?? m.druzynaBId;
        expect(m.zwyciezcaId).toBe(obecna);
        expect(m.walkowerDla).toBe(obecna);
      }
    }
  }

  it.each([2, 3, 4, 5, 6, 7, 8, 12, 16])('%i drużyn: drabinka spójna, wolne losy tam gdzie trzeba', (n) => {
    sprawdzDrabinke(n);
  });

  it('mecz o 3. miejsce bierze PRZEGRANYCH obu półfinałów', () => {
    const mecze = zbudujDrabinke(['a', 'b', 'c', 'd'], { startNumer: 1, meczO3Miejsce: true, noweId: idFabryka() });
    const o3 = mecze.find((m) => m.faza === 'o_3_miejsce');
    expect(o3).toBeDefined();
    expect(o3!.zrodloATyp).toBe('przegrany');
    expect(o3!.zrodloBTyp).toBe('przegrany');
    const polfinaly = mecze.filter((m) => m.faza === 'polfinal');
    expect(polfinaly.map((m) => m.id).sort()).toEqual([o3!.zrodloAMeczId, o3!.zrodloBMeczId].sort());
  });

  it('bez meczO3Miejsce nie dokłada dodatkowego meczu', () => {
    const mecze = zbudujDrabinke(['a', 'b', 'c', 'd'], { startNumer: 1, noweId: idFabryka() });
    expect(mecze.some((m) => m.faza === 'o_3_miejsce')).toBe(false);
  });

  it('mniej niż 2 drużyny: brak drabinki', () => {
    expect(zbudujDrabinke(['a'], { startNumer: 1 })).toEqual([]);
  });
});

describe('ulozHarmonogram', () => {
  const bazowyStart = '2026-10-01T09:00:00.000Z';

  it('rozstawia mecze tej samej kolejki równolegle na wszystkich arenach', () => {
    const mecze: NowyMecz[] = [
      { id: '1', numer: 1, faza: 'grupa', kolejka: 1, druzynaAId: 'a', druzynaBId: 'b' },
      { id: '2', numer: 2, faza: 'grupa', kolejka: 1, druzynaAId: 'c', druzynaBId: 'd' },
    ];
    const wynik = ulozHarmonogram(mecze, { arenyId: ['A1', 'A2'], startAt: bazowyStart, czasMeczuMin: 15, przerwaMin: 5 });
    expect(wynik.every((m) => m.zaplanowanyAt === bazowyStart)).toBe(true);
    expect(new Set(wynik.map((m) => m.arenaId))).toEqual(new Set(['A1', 'A2']));
  });

  it('gdy aren mniej niż meczów w kolejce, nadmiar idzie na kolejną falę', () => {
    const mecze: NowyMecz[] = [
      { id: '1', numer: 1, faza: 'grupa', kolejka: 1, druzynaAId: 'a', druzynaBId: 'b' },
      { id: '2', numer: 2, faza: 'grupa', kolejka: 1, druzynaAId: 'c', druzynaBId: 'd' },
      { id: '3', numer: 3, faza: 'grupa', kolejka: 1, druzynaAId: 'e', druzynaBId: 'f' },
    ];
    const wynik = ulozHarmonogram(mecze, { arenyId: ['A1'], startAt: bazowyStart, czasMeczuMin: 15, przerwaMin: 5 });
    const czasy = wynik.map((m) => m.zaplanowanyAt).sort();
    expect(new Set(czasy).size).toBe(3); // jedna arena → każdy mecz osobna fala
    expect(czasy[1]).toBe('2026-10-01T09:20:00.000Z'); // +20 min (15+5)
    expect(czasy[2]).toBe('2026-10-01T09:40:00.000Z');
  });

  it('kolejna kolejka zaczyna się po ostatniej fali poprzedniej', () => {
    const mecze: NowyMecz[] = [
      { id: '1', numer: 1, faza: 'grupa', kolejka: 1, druzynaAId: 'a', druzynaBId: 'b' },
      { id: '2', numer: 2, faza: 'grupa', kolejka: 1, druzynaAId: 'c', druzynaBId: 'd' },
      { id: '3', numer: 3, faza: 'grupa', kolejka: 2, druzynaAId: 'a', druzynaBId: 'c' },
    ];
    const wynik = ulozHarmonogram(mecze, { arenyId: ['A1'], startAt: bazowyStart, czasMeczuMin: 15, przerwaMin: 5 });
    const trzeci = wynik.find((m) => m.id === '3')!;
    // Kolejka 1 na jednej arenie zajęła 2 fale (2 mecze) = 40 minut.
    expect(trzeci.zaplanowanyAt).toBe('2026-10-01T09:40:00.000Z');
  });

  it('nie nadaje terminu meczom już rozstrzygniętym (wolne losy)', () => {
    const mecze: NowyMecz[] = [
      { id: '1', numer: 1, faza: 'polfinal', kolejka: 1, druzynaAId: 'a', druzynaBId: 'b' },
      { id: '2', numer: 2, faza: 'polfinal', kolejka: 1, status: 'walkower', druzynaAId: 'c', zwyciezcaId: 'c', walkowerDla: 'c' },
    ];
    const wynik = ulozHarmonogram(mecze, { arenyId: ['A1'], startAt: bazowyStart, czasMeczuMin: 15, przerwaMin: 5 });
    const bye = wynik.find((m) => m.id === '2')!;
    expect(bye.zaplanowanyAt).toBeUndefined();
    expect(bye.arenaId).toBeUndefined();
  });

  it('zachowuje kolejność numerów niezależnie od porządku wejściowego', () => {
    const mecze: NowyMecz[] = [
      { id: '2', numer: 2, faza: 'grupa', kolejka: 1, druzynaAId: 'c', druzynaBId: 'd' },
      { id: '1', numer: 1, faza: 'grupa', kolejka: 1, druzynaAId: 'a', druzynaBId: 'b' },
    ];
    const wynik = ulozHarmonogram(mecze, { arenyId: ['A1', 'A2'], startAt: bazowyStart, czasMeczuMin: 15, przerwaMin: 5 });
    expect(wynik.map((m) => m.numer)).toEqual([1, 2]);
  });
});

describe('szacunekCzasu', () => {
  it('liczy fale i czas z podziałem na areny', () => {
    const mecze: NowyMecz[] = Array.from({ length: 12 }, (_, i) => ({
      id: `${i}`,
      numer: i + 1,
      faza: 'grupa' as const,
      kolejka: Math.floor(i / 4) + 1, // 3 kolejki po 4 mecze
      druzynaAId: 'a',
      druzynaBId: 'b',
    }));
    const wynik = szacunekCzasu(mecze, { liczbaAren: 2, czasMeczuMin: 15, przerwaMin: 5 });
    // 4 mecze / 2 areny = 2 fale na kolejkę × 3 kolejki = 6 fal
    expect(wynik.liczbaMeczow).toBe(12);
    expect(wynik.liczbaFal).toBe(6);
    expect(wynik.czasCalkowityMin).toBe(6 * 20);
  });

  it('nie liczy meczów już rozstrzygniętych do czasu gry', () => {
    const mecze: NowyMecz[] = [
      { id: '1', numer: 1, faza: 'polfinal', kolejka: 1, druzynaAId: 'a', druzynaBId: 'b' },
      { id: '2', numer: 2, faza: 'polfinal', kolejka: 1, status: 'walkower', zwyciezcaId: 'c' },
    ];
    const wynik = szacunekCzasu(mecze, { liczbaAren: 2, czasMeczuMin: 15, przerwaMin: 5 });
    expect(wynik.liczbaMeczow).toBe(1);
    expect(wynik.liczbaFal).toBe(1);
  });

  it('z podanym startAt liczy moment końca', () => {
    const mecze: NowyMecz[] = [
      { id: '1', numer: 1, faza: 'grupa', kolejka: 1, druzynaAId: 'a', druzynaBId: 'b' },
    ];
    const wynik = szacunekCzasu(mecze, {
      liczbaAren: 1,
      czasMeczuMin: 15,
      przerwaMin: 5,
      startAt: '2026-10-01T09:00:00.000Z',
    });
    expect(wynik.koniecAt).toBe('2026-10-01T09:20:00.000Z');
  });
});
