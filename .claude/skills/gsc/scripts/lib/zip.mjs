// Minimal ZIP reader (stored + deflate), zero dependencies.
//
// Search Console hands every report out as a ZIP of CSV files. `unzip` is not
// guaranteed on the machines this runs on (Windows, slim containers), and a
// dependency for three CSV files would be silly, so this reads the central
// directory itself and inflates entries with node:zlib.

import { inflateRawSync } from 'node:zlib';

const SYG_EOCD = 0x06054b50; // end of central directory
const SYG_CEN = 0x02014b50;  // central directory file header
const SYG_LOC = 0x04034b50;  // local file header

function dekodujNazwe(bufor, utf8) {
  if (utf8) return bufor.toString('utf8');
  // Many tools write UTF-8 names without setting the flag; try strict UTF-8
  // first and fall back to latin1 so a name never becomes mojibake silently.
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bufor);
  } catch {
    return bufor.toString('latin1');
  }
}

/** Returns [{ nazwa, dane: Buffer }] for every file entry in the archive. */
export function czytajZip(bufor) {
  // EOCD sits in the last 22 bytes + up to 64 KiB of comment.
  const start = Math.max(0, bufor.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = bufor.length - 22; i >= start; i--) {
    if (bufor.readUInt32LE(i) === SYG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('To nie jest plik ZIP (brak katalogu centralnego).');

  const liczbaWpisow = bufor.readUInt16LE(eocd + 10);
  let wsk = bufor.readUInt32LE(eocd + 16);
  const pliki = [];

  for (let n = 0; n < liczbaWpisow; n++) {
    if (bufor.readUInt32LE(wsk) !== SYG_CEN) throw new Error('Uszkodzony katalog centralny ZIP.');
    const flagi = bufor.readUInt16LE(wsk + 8);
    const metoda = bufor.readUInt16LE(wsk + 10);
    const rozmiarSkompr = bufor.readUInt32LE(wsk + 20);
    const dlNazwy = bufor.readUInt16LE(wsk + 28);
    const dlExtra = bufor.readUInt16LE(wsk + 30);
    const dlKoment = bufor.readUInt16LE(wsk + 32);
    const offsetLokalny = bufor.readUInt32LE(wsk + 42);
    const nazwa = dekodujNazwe(bufor.subarray(wsk + 46, wsk + 46 + dlNazwy), (flagi & 0x800) !== 0);
    wsk += 46 + dlNazwy + dlExtra + dlKoment;

    if (nazwa.endsWith('/')) continue; // directory entry

    if (bufor.readUInt32LE(offsetLokalny) !== SYG_LOC) throw new Error(`Uszkodzony nagłówek pliku ${nazwa}.`);
    const lokDlNazwy = bufor.readUInt16LE(offsetLokalny + 26);
    const lokDlExtra = bufor.readUInt16LE(offsetLokalny + 28);
    const poczatek = offsetLokalny + 30 + lokDlNazwy + lokDlExtra;
    const surowe = bufor.subarray(poczatek, poczatek + rozmiarSkompr);

    let dane;
    if (metoda === 0) dane = Buffer.from(surowe);
    else if (metoda === 8) dane = inflateRawSync(surowe);
    else throw new Error(`Nieobsługiwana metoda kompresji ${metoda} w ${nazwa}.`);

    pliki.push({ nazwa, dane });
  }
  return pliki;
}

// --- writer (stored, no compression) — used by tests to build fixtures ---

const TABLICA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bufor) {
  let c = 0xffffffff;
  for (const b of bufor) c = TABLICA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Build a ZIP (stored entries, UTF-8 names) from { nazwa: string|Buffer }. */
export function zbudujZip(pliki) {
  const lokalne = [];
  const centralne = [];
  let offset = 0;
  for (const [nazwa, tresc] of Object.entries(pliki)) {
    const dane = Buffer.isBuffer(tresc) ? tresc : Buffer.from(tresc, 'utf8');
    const bNazwa = Buffer.from(nazwa, 'utf8');
    const crc = crc32(dane);
    const lok = Buffer.alloc(30);
    lok.writeUInt32LE(SYG_LOC, 0);
    lok.writeUInt16LE(20, 4);
    lok.writeUInt16LE(0x800, 6);
    lok.writeUInt16LE(0, 8);
    lok.writeUInt32LE(crc, 14);
    lok.writeUInt32LE(dane.length, 18);
    lok.writeUInt32LE(dane.length, 22);
    lok.writeUInt16LE(bNazwa.length, 26);
    lokalne.push(lok, bNazwa, dane);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(SYG_CEN, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x800, 8);
    cen.writeUInt16LE(0, 10);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(dane.length, 20);
    cen.writeUInt32LE(dane.length, 24);
    cen.writeUInt16LE(bNazwa.length, 28);
    cen.writeUInt32LE(offset, 42);
    centralne.push(cen, bNazwa);
    offset += 30 + bNazwa.length + dane.length;
  }
  const cenBuf = Buffer.concat(centralne);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(SYG_EOCD, 0);
  eocd.writeUInt16LE(Object.keys(pliki).length, 8);
  eocd.writeUInt16LE(Object.keys(pliki).length, 10);
  eocd.writeUInt32LE(cenBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...lokalne, cenBuf, eocd]);
}
