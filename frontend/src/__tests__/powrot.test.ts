import { describe, it, expect, beforeEach } from 'vitest';
import { zapiszPowrot, odczytajPowrot } from '@/lib/powrot';

beforeEach(() => { sessionStorage.clear(); });

describe('zapiszPowrot / odczytajPowrot', () => {
  it('oddaje zapamiętany cel', () => {
    zapiszPowrot('/mapa?boisko=abc');
    expect(odczytajPowrot()).toBe('/mapa?boisko=abc');
  });

  // Jednorazowy, żeby stara wartość nie podpowiadała złego celu przy kolejnej,
  // niepowiązanej wizycie na /boisko/[id].
  it('oddaje cel tylko raz', () => {
    zapiszPowrot('/wydarzenia/1');
    expect(odczytajPowrot()).toBe('/wydarzenia/1');
    expect(odczytajPowrot()).toBeNull();
  });

  it('nic nie zapamiętuje, gdy cel prowadzi poza witrynę', () => {
    zapiszPowrot('//zlo.example/phishing');
    expect(odczytajPowrot()).toBeNull();
  });

  it('nic nie zapamiętuje dla adresu z innym hostem', () => {
    zapiszPowrot('https://zlo.example');
    expect(odczytajPowrot()).toBeNull();
  });

  it('bez wcześniejszego zapisu oddaje null', () => {
    expect(odczytajPowrot()).toBeNull();
  });
});
