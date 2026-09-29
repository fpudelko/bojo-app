/**
 * Silnik animacji telefonu z pierwszego ekranu strony głównej.
 *
 * Przepisany z makiety `bojo-hero.html` bez zmiany logiki: ta sama oś czasu,
 * te same rozdziały, ten sam palec. Makieta została sprawdzona w przeglądarce
 * (pętla 54 s, rozdziały zgodne z paskami, klik w pasek w trakcie odtwarzania
 * i po zawinięciu pętli), więc przepisanie na deklaratywny React zamiast
 * przeniesienia tego, co działa, byłoby ryzykiem bez zysku: ekran sterowany
 * DOM-em nie ma stanu, który React mógłby rozsądnie posiadać.
 *
 * Zmiany względem makiety, wszystkie celowe:
 *  - wszystko szuka elementów w `root`, nie w `document` (brak kolizji id),
 *  - podpisy, nazwy rozdziałów i skala żyją poza silnikiem (`InterfejsHero`),
 *    bo należą do układu strony, nie do telefonu,
 *  - daty przychodzą z `lib/datyHero.ts`, nie są wpisane na sztywno,
 *  - organizator nazywa się „Marek Sikora” (inicjał „M” w nagłówku aplikacji).
 *
 * Wszystkie napisy widoczne poza telefonem (podpisy, nazwy rozdziałów) idą
 * z `LANDING_ANIMACJA` w `content.ts`, żeby test zakazanych fraz je widział.
 */
import { LANDING_ANIMACJA } from '../content';
import type { DatyHero } from '@/lib/datyHero';

const CH = LANDING_ANIMACJA.rozdzialy;
const P = LANDING_ANIMACJA.podpisy;

/** Co silnik zgłasza układowi strony (podpis, plakietka, paski). */
export interface InterfejsHero {
  /** Podpis pod telefonem. `natychmiast` = bez płynnej zmiany. */
  podpis(tekst: string, natychmiast: boolean): void;
  /** Zaczął się rozdział `i`: nazwa pod telefonem (mobile) i plakietka (komputer). */
  rozdzial(i: number, natychmiast: boolean): void;
  /** Postęp: `aktualny` to indeks rozdziału, `procent` 0-100 wypełnienia jego paska. */
  paski(aktualny: number, procent: number): void;
}

export interface SilnikHero {
  /** Klik w pasek: skok na początek rozdziału `i` i dalej samoczynnie. */
  przejdzDo(i: number): void;
  zatrzymaj(): void;
}

interface Opcje {
  root: HTMLElement;
  daty: DatyHero;
  ui: InterfejsHero;
  ograniczonyRuch: boolean;
}

interface Gracz { n: string; c?: number; org?: 1; br?: 1; g?: 1; self?: 1 }

const COLORS = ['#7C5B3E', '#4E6A8A', '#8A4E5E', '#5B7A4E', '#6A5B8A', '#3E7C78', '#8A6E3E'];
const ORGANIZATOR = 'Marek Sikora';
const ROSTER: Gracz[] = [
  { n: ORGANIZATOR, org: 1 },
  { n: 'Jakub Kowalski', c: 0 }, { n: 'Kacper Wójcik', c: 1 }, { n: 'Mateusz Nowak', c: 2, br: 1 },
  { n: 'Piotr Wiśniewski', c: 3 }, { n: 'Szymon Mazur', g: 1 }, { n: 'Bartek Lis', g: 1 },
  { n: 'Filip Jankowski', g: 1, self: 1 },
];
const LATER: Gracz[] = [{ n: 'Michał Kamiński', c: 4 }, { n: 'Adam Krawczyk', g: 1 }, { n: 'Wojtek Król', c: 5 }];
const LAST: Gracz[] = [{ n: 'Łukasz Dudek', c: 6 }, { n: 'Kamil Nowicki', c: 0 }];
const TB = ['Marek S.', 'Jakub K.', 'Piotr W.', 'Bartek L.', 'Adam K.', 'Kuba', 'Kamil N.'];
const TR = ['Kacper W.', 'Mateusz N.', 'Szymon M.', 'Filip J.', 'Michał K.', 'Wojtek K.', 'Łukasz D.'];
// [imię, metoda, zapłacił, indeks koloru (-1 = jasny)]
const PAY: [string, string, number, number][] = [
  ['Jakub Kowalski', 'BLIK', 1, 0], ['Kacper Wójcik', 'BLIK', 1, 1], ['Mateusz Nowak', 'Gotówka', 1, 2],
  ['Piotr Wiśniewski', 'BLIK', 0, 3], ['Szymon Mazur', 'BLIK', 0, -1], ['Bartek Lis', 'Gotówka', 0, -1],
  ['Filip Jankowski', 'BLIK', 1, -1], ['Michał Kamiński', 'BLIK', 0, 4],
];

const initials = (n: string) => n.split(' ').map((s) => s[0]).join('').slice(0, 2);
const ic = (n: string, c?: string) => `<svg class="i ${c || ''}"><use href="#ha-ic-${n}"/></svg>`;

export function uruchomHero({ root, daty: d, ui, ograniczonyRuch: reduce }: Opcje): SilnikHero {
  let runId = 0;
  let paused = true;
  let started = false;
  let instant = false;
  let visible = false;
  let cur = 0;
  let chElapsed = 0;
  let count = 0;
  let paid = 9;

  /* ---------- dostęp do elementów ---------- */
  function el(id: string): HTMLElement {
    const e = root.querySelector<HTMLElement>('#' + id);
    if (!e) throw new Error('hero: brak elementu #' + id);
    return e;
  }
  const ekranTelefonu = root.querySelector<HTMLElement>('.screen');
  if (!ekranTelefonu) throw new Error('hero: brak ekranu telefonu (.screen)');
  const screen: HTMLElement = ekranTelefonu;
  const finger = el('finger');
  const skala = () => parseFloat(root.style.getPropertyValue('--s')) || 0.66;

  /* ---------- czas ---------- */
  function paintBars() { ui.paski(cur, Math.min(100, (chElapsed / CH[cur].czasMs) * 100)); }

  function wait(ms: number): Promise<void> {
    if (instant) return Promise.resolve();
    const my = runId;
    return new Promise((res, rej) => {
      let left = ms;
      let last = performance.now();
      (function f(now: number) {
        if (my !== runId) { rej(new Error('abort')); return; }
        const dt = paused ? 0 : Math.min(100, now - last);
        left -= dt; chElapsed += dt; last = now;
        paintBars();
        if (left <= 0) res(); else requestAnimationFrame(f);
      })(last);
    });
  }
  async function padTo(ms: number) {
    while (chElapsed < ms) await wait(Math.min(200, ms - chElapsed + 1));
  }

  const cap = (t: string) => ui.podpis(t, instant || reduce);
  function setChapter(i: number) {
    cur = i; chElapsed = 0; paintBars();
    ui.rozdzial(i, instant || reduce);
  }

  /* ---------- ekrany, palec, pola ---------- */
  function show(id: string) {
    root.querySelectorAll('.scr').forEach((s) => s.classList.toggle('on', s.id === id));
  }
  function rel(e: HTMLElement) {
    const r = e.getBoundingClientRect();
    const sr = screen.getBoundingClientRect();
    const S = skala();
    return { x: (r.left + r.width / 2 - sr.left) / S, y: (r.top + r.height / 2 - sr.top) / S };
  }
  async function tap(e: HTMLElement, hold?: number) {
    if (instant) return;
    const p = rel(e);
    finger.style.left = p.x + 'px'; finger.style.top = p.y + 'px'; finger.classList.add('on');
    await wait(360);
    finger.classList.remove('press'); void finger.offsetWidth; finger.classList.add('press');
    e.classList.remove('hit'); void e.offsetWidth; e.classList.add('hit');
    await wait(hold || 220);
  }
  const lift = () => finger.classList.remove('on');
  function vOf(box: HTMLElement): HTMLElement {
    const v = box.querySelector<HTMLElement>('.v');
    if (!v) throw new Error('hero: pole bez .v');
    return v;
  }
  function setV(box: HTMLElement, text: string, ph?: boolean) {
    const v = vOf(box); v.textContent = text; v.classList.toggle('ph', !!ph);
  }
  async function type(box: HTMLElement, text: string, speed?: number) {
    const v = vOf(box);
    if (instant) { v.textContent = text; v.classList.remove('ph'); return; }
    box.classList.add('focus', 'caret'); v.classList.remove('ph'); v.textContent = '';
    for (const ch of text) { v.textContent += ch; await wait(speed || 55); }
    await wait(120); box.classList.remove('caret', 'focus');
  }
  function scrollBy(innerId: string, e: HTMLElement, pad?: number) {
    const inner = el(innerId);
    const vp = inner.parentElement;
    if (!vp) return;
    const ir = inner.getBoundingClientRect();
    const er = e.getBoundingClientRect();
    const y = Math.max(0, (er.bottom - ir.top) / skala() - vp.clientHeight + (pad || 16));
    inner.style.transform = 'translateY(' + (-y) + 'px)';
  }
  function scrollTop(innerId: string) { el(innerId).style.transform = ''; }
  const on = (id: string, v?: boolean) => el(id).classList.toggle('on', v !== false);

  /* ---------- skład ---------- */
  function rowHTML(p: Gracz): string {
    const av = p.org || p.g
      ? `<span class="ai lt">${p.n[0]}</span>`
      : `<span class="ai" style="background:${COLORS[(p.c ?? 0) % COLORS.length]}">${initials(p.n)}</span>`;
    let h = `<div class="pl-t">${av}<span class="nm">${p.n}</span>` +
      (p.g ? '<span class="tg gs">GOŚĆ</span>' : '') +
      `<span class="tg po">${p.br ? '🧤 BR' : '⚽ POLE'}</span>` + (p.org ? '<span class="org">· org</span>' : '') + '</div>';
    if (p.g && !p.self) {
      h += `<div class="pl-s"><span class="ai lt" style="width:16px;height:16px;font-size:9px">${ORGANIZATOR[0]}</span>dodał(a): ${ORGANIZATOR}</div>` +
        `<div class="pl-s lk">${ic('link', 'xs')}Wyślij link do zapisu</div>`;
    }
    if (p.self) h += `<div class="pl-s lk">${ic('link', 'xs')}Zapisał się bez konta</div>`;
    if (!p.org) h += `<div class="pl-a"><span>${ic('trash', 'xs')}Usuń</span><span>${ic('clock', 'xs')}Na rezerwę</span></div>`;
    return h;
  }
  function paintCount() {
    const left = 14 - count;
    el('o-big').textContent = count + ' / 14';
    el('o-bar').style.width = (count / 14 * 100) + '%';
    el('o-barw').classList.toggle('full', !left);
    el('o-left').textContent = left
      ? 'Zostało ' + left + ' ' + (left === 1 ? 'wolne miejsce' : (left < 5 ? 'wolne miejsca' : 'wolnych miejsc'))
      : 'Komplet';
    el('o-left').classList.toggle('full', !left);
    el('o-sub').style.display = left ? '' : 'none';
    el('o-stack').style.display = left ? 'none' : 'flex';
    el('o-hd').textContent = count + ' GRACZY' + (left ? '' : ' · 2 NA REZERWIE');
  }
  function addRow(p: Gracz, animate: boolean) {
    const div = document.createElement('div');
    div.className = 'pl' + (animate ? ' new' : '');
    div.innerHTML = rowHTML(p);
    el('o-rows').appendChild(div); count++; paintCount();
  }
  function addRes(n: number, name: string) {
    const div = document.createElement('div');
    div.className = 'rr pl new';
    div.style.borderBottom = '0'; div.style.padding = '9px 0';
    div.innerHTML = `<span class="n">${n}</span><span>${name}</span><span class="ds">Do składu</span><span style="color:#9AA1AB">${ic('trash', 's')}</span>`;
    el('o-resrows').appendChild(div);
  }
  el('o-stack').innerHTML =
    ['MS', 'JK', 'KW', 'MN', 'PW', 'SM', 'BL'].map((t, k) =>
      `<span style="background:${['#2E6B2F'].concat(COLORS)[k]}">${t}</span>`).join('') +
    '<span style="background:#E5E7EB;color:#4B5563">+7</span>';

  /* ---------- czat ---------- */
  function msg(who: string | null, html: string, color: string | null, out?: boolean) {
    const m = document.createElement('div');
    m.className = 'msg' + (out ? ' out' : '');
    m.innerHTML = (who && !out ? `<span class="who" style="color:${color}">${who}</span>` : '') + html +
      `<span class="tm">${out ? '21:33 ✓✓' : '21:34'}</span>`;
    el('chat').appendChild(m);
  }

  function paintPay() {
    el('p-cnt').textContent = paid + ' / 13';
    el('p-sum').textContent = (paid * 15) + ',00 zł';
  }

  /* ---------- stan na początku rozdziału ---------- */
  const SETUP: (() => void)[] = [
    () => {
      scrollTop('w1-in'); el('w1-sport').classList.add('on');
      setV(el('w1-date'), d.start); el('w1-dh').textContent = d.startOpis;
      setV(el('w1-h'), '18'); el('w1-end').textContent = 'Koniec o 19:30'; el('w1-max').textContent = '10';
      on('w1-ptog', false); el('w1-more').classList.remove('show'); setV(el('w1-cost'), ''); el('w1-calc').innerHTML = '&nbsp;';
      el('w1-blik').classList.remove('ok'); el('w1-cash').classList.remove('ok');
      setV(el('w2-q'), 'Szukaj adresu lub nazwy miejsca…', true); on('w2-sugg', false); on('w2-pin', false); on('w2-pick', false);
      setV(el('w3-title'), 'Piłka nożna 7v7', true); on('w3-dim', false); on('w3-dlg', false);
      el('w3-go').classList.remove('load'); el('w3-go').textContent = 'Opublikuj mecz';
      show('s-w1');
    },
    () => { on('rd-dim', false); on('rd-sheet', false); el('chat').innerHTML = ''; show('s-ready'); },
    () => {
      el('g-big').textContent = '7 / 14'; el('g-bar').style.width = '50%'; el('g-left').textContent = 'Zostało 7 wolnych miejsc';
      setV(el('g-name'), 'np. Jan Kowalski', true); setV(el('g-mail'), 'twój@email.com', true); el('g-blik').classList.remove('ok');
      on('g-dim', false); on('g-dlg', false); on('g-toast', false); el('g-foot').style.display = ''; el('g-foot2').style.display = 'none';
      show('s-guest');
    },
    () => {
      scrollTop('o-in'); el('o-rows').innerHTML = ''; count = 0; ROSTER.forEach((p) => addRow(p, false));
      el('o-resrows').innerHTML = ''; on('o-res', false); on('o-dim', false); on('o-dlg', false); on('o-sheet', false); setV(el('o-name'), 'Imię znajomego', true);
      show('s-org');
    },
    () => {
      scrollTop('k-in'); on('k-grid', false); el('k-b').innerHTML = ''; el('k-r').innerHTML = ''; el('k-nb').textContent = '0'; el('k-nr').textContent = '0';
      el('k-vs').innerHTML = '<b>0</b> vs <i>0</i>';
      el('k-pool').style.display = '';
      el('k-pool').innerHTML = '<div class="hd">Nieprzypisani: 14</div>' +
        [ORGANIZATOR, 'Jakub Kowalski', 'Kacper Wójcik', 'Mateusz Nowak', 'Piotr Wiśniewski', 'Szymon Mazur', 'Bartek Lis'].map((n) =>
          `<div class="pr"><span>${n}</span><span><i style="background:var(--bl)">N</i><i style="background:var(--rd)">C</i></span></div>`).join('');
      paid = 9; paintPay();
      el('p-rows').innerHTML = PAY.map((p, k) =>
        `<div class="pay"><span class="ai${p[3] < 0 ? ' lt' : ''}"${p[3] < 0 ? '' : ` style="background:${COLORS[p[3]]}"`}>${p[3] < 0 ? p[0][0] : initials(p[0])}</span>` +
        `<span class="nm2">${p[0]}<small>15,00 zł · ${p[1]}</small></span><span class="tog${p[2] ? ' on' : ''}" id="pt${k}"></span></div>`).join('');
      on('p-toast', false); el('a-rows').innerHTML = ''; el('a-score').style.opacity = '0';
      show('s-sk');
    },
  ];

  /* ---------- rozdziały ---------- */
  const PLAY: (() => Promise<void>)[] = [
    async () => { // 1 · Zakładasz mecz
      cap(P.termin);
      await wait(350);
      await tap(el('w1-date')); setV(el('w1-date'), d.cel); el('w1-dh').textContent = d.celOpis;
      const plus = el('w1-plus'); await tap(plus, 80);
      for (let v = 11; v <= 14; v++) {
        el('w1-max').textContent = String(v);
        if (!instant) { finger.classList.remove('press'); void finger.offsetWidth; finger.classList.add('press'); }
        await wait(170);
      }
      lift(); scrollBy('w1-in', el('w1-paid'), 24); await wait(300);
      await tap(el('w1-ptog')); on('w1-ptog'); el('w1-more').classList.add('show'); await wait(380);
      scrollBy('w1-in', el('w1-paid'), 20); await wait(420); lift();
      await type(el('w1-cost'), '210', 100);
      el('w1-calc').innerHTML = 'Przy 14 miejscach wychodzi <b>15,00 zł od osoby</b>.';
      await wait(550);
      await tap(el('w1-next')); lift();
      cap(P.boisko);
      show('s-w2'); await wait(350);
      await tap(el('w2-q')); lift(); await type(el('w2-q'), 'Boisko Grun', 45);
      on('w2-sugg'); await wait(250);
      await tap(el('w2-s1')); on('w2-sugg', false); setV(el('w2-q'), 'Boisko Grunwald'); on('w2-pin'); await wait(250); on('w2-pick');
      await wait(350); await tap(el('w2-next')); lift();
      cap(P.publikacja);
      show('s-w3'); setV(el('w3-title'), 'Czwartkowa ligówka'); await wait(500);
      await tap(el('w3-next')); lift(); on('w3-dim'); on('w3-dlg');
      await wait(1000);
      await tap(el('w3-go')); el('w3-go').classList.add('load'); el('w3-go').textContent = 'Publikuję…'; lift();
    },
    async () => { // 2 · Wysyłasz link
      cap(P.link);
      await wait(900);
      await tap(el('rd-share')); lift(); on('rd-dim'); on('rd-sheet');
      await wait(700); await tap(el('rd-wa')); lift();
      await wait(250);
      cap(P.czat);
      show('s-wa'); el('chat').innerHTML = '';
      msg('Kuba', 'gramy w czwartek?', '#b86a00');
      await wait(500);
      msg(null, `<div class="lcard"><div class="th"><span>bojo</span></div><div class="mt"><div class="t">⚽ Czwartkowa ligówka</div><div class="d">${d.celDlugaWielka}, 18:00. Boisko Grunwald.</div><div class="u">bojo.pl</div></div></div>Zapisujcie się tutaj 👇<br><span class="link">bojo.pl/wydarzenia/5ebe…</span>`, null, true);
      await wait(1100); msg('Ola', 'zapisana 👍', '#b0417a');
      await wait(600); msg('Bartek', 'wbijam', '#3f5fbf');
    },
    async () => { // 3 · Gracze się zapisują
      cap(P.gracz);
      await wait(900);
      await tap(el('g-join')); lift(); on('g-dim'); on('g-dlg');
      await wait(1200);
      cap(P.dane);
      await tap(el('g-name')); lift(); await type(el('g-name'), 'Filip Jankowski', 45);
      await tap(el('g-mail')); lift(); await type(el('g-mail'), 'filip@gmail.com', 40);
      await tap(el('g-blik')); el('g-blik').classList.add('ok'); await wait(250);
      await tap(el('g-save')); lift(); on('g-dlg', false); on('g-dim', false);
      cap(P.wSkladzie);
      await wait(250); on('g-toast');
      el('g-big').textContent = '8 / 14'; el('g-bar').style.width = (8 / 14 * 100) + '%'; el('g-left').textContent = 'Zostało 6 wolnych miejsc';
      el('g-foot').style.display = 'none'; el('g-foot2').style.display = 'flex';
    },
    async () => { // 4 · Skład pod kontrolą
      cap(P.sklad);
      await wait(800);
      for (const p of LATER) { addRow(p, true); scrollBy('o-in', el('o-add'), 16); await wait(650); }
      await wait(400);
      cap(P.dopisz);
      await tap(el('o-add')); lift(); on('o-dim'); on('o-dlg'); await wait(350);
      await type(el('o-name'), 'Kuba', 90); el('o-name').classList.add('focus');
      await tap(el('o-addok')); lift(); on('o-dlg', false);
      on('o-sheet'); await wait(1300); on('o-sheet', false); on('o-dim', false);
      addRow({ n: 'Kuba', g: 1 }, true); scrollBy('o-in', el('o-add'), 16);
      await wait(700);
      cap(P.rezerwa);
      for (const p of LAST) { addRow(p, true); scrollBy('o-in', el('o-add'), 16); await wait(550); }
      on('o-res'); addRes(1, 'Oskar Pawlak'); scrollBy('o-in', el('o-res'), 16); await wait(500);
      addRes(2, 'Dawid Baran'); scrollBy('o-in', el('o-res'), 16);
      await wait(300);
    },
    async () => { // 5 · Drużyny i rozliczenie
      cap(P.losowanie);
      await wait(600);
      await tap(el('k-rand')); lift();
      el('k-pool').style.display = 'none'; on('k-grid');
      for (let k = 0; k < 7; k++) {
        const pary: [string, string][] = [['k-b', TB[k]], ['k-r', TR[k]]];
        for (const [id, n] of pary) {
          const div = document.createElement('div');
          div.className = 'tp'; div.innerHTML = '<s>⋮⋮</s><i></i>' + n;
          el(id).appendChild(div);
        }
        el('k-nb').textContent = String(k + 1); el('k-nr').textContent = String(k + 1);
        el('k-vs').innerHTML = '<b>' + (k + 1) + '</b> vs <i>' + (k + 1) + '</i>';
        scrollBy('k-in', el('k-grid'), 16);
        await wait(230);
      }
      await wait(1000);
      cap(P.wplaty);
      show('s-pay'); await wait(500);
      const oddali: [number, string][] = [[3, 'Piotr Wiśniewski'], [4, 'Szymon Mazur'], [5, 'Bartek Lis']];
      for (const [k, name] of oddali) {
        await tap(el('pt' + k)); lift(); on('pt' + k); paid++; paintPay();
        el('p-tt').textContent = name + ': wpłata odhaczona'; on('p-toast');
        await wait(420);
      }
      await wait(300); on('p-toast', false);
      cap(P.poMeczu);
      show('s-after'); await wait(400);
      const rows: [string, string, string, number][] = [
        ['a', 'cash', '1 osoba jeszcze nie oddała', 1],
        ['g', 'check', 'Wynik wpisany', 0],
        ['a', 'uplus', '5 gości bez konta w składzie', 1],
      ];
      for (const r of rows) {
        const div = document.createElement('div');
        div.className = 'am pop';
        div.innerHTML = `<span class="ico ${r[0]}">${ic(r[1], 's')}</span>${r[2]}` + (r[3] ? `<span class="chv">${ic('chr', 's')}</span>` : '');
        el('a-rows').appendChild(div); await wait(380);
      }
      el('a-score').style.opacity = '1';
    },
  ];

  /* ---------- pętla ---------- */
  async function playFrom(i: number) {
    const my = ++runId; lift();
    try {
      for (let c = i; ; c = (c + 1) % CH.length) {
        setChapter(c); SETUP[c]();
        await PLAY[c]();
        await padTo(CH[c].czasMs);
        if (my !== runId) return;
      }
    } catch { /* wyparta przez nowsze odtwarzanie albo zatrzymana */ }
  }
  function renderStatic(i: number) {
    runId++; instant = true; root.classList.add('instant');
    setChapter(i); SETUP[i]();
    PLAY[i]().then(() => {
      lift(); ui.podpis(CH[i].spoczynek, true);
      el('w3-go').classList.remove('load'); el('w3-go').textContent = 'Opublikuj mecz';
      chElapsed = CH[i].czasMs; paintBars();
      requestAnimationFrame(() => { root.classList.remove('instant'); instant = false; });
    }).catch(() => { root.classList.remove('instant'); instant = false; });
  }
  function updatePause() {
    paused = !(visible && !document.hidden);
    root.classList.toggle('paused', paused);
  }
  function przejdzDo(i: number) {
    if (reduce) { renderStatic(i); return; }
    started = true; updatePause(); void playFrom(i);
  }

  /* ---------- start ---------- */
  let io: IntersectionObserver | null = null;
  const naZmianeWidocznosci = () => updatePause();
  if (reduce) {
    renderStatic(3);
  } else {
    // Stan spoczynkowy: pierwsza klatka rozdziału 1. Animacja rusza dopiero,
    // gdy telefon jest widoczny w połowie (na telefonie leży pod pierwszym
    // ekranem), i zawsze od rozdziału 1: bez tego gracz trafiałby w środek pętli.
    setChapter(0); SETUP[0](); cap(P.termin);
    io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        visible = e.intersectionRatio >= 0.5;
        if (visible && !started) { started = true; updatePause(); void playFrom(0); } else updatePause();
      });
    }, { threshold: [0, 0.5, 1] });
    io.observe(root);
    document.addEventListener('visibilitychange', naZmianeWidocznosci);
  }

  return {
    przejdzDo,
    zatrzymaj() {
      runId++;
      io?.disconnect();
      document.removeEventListener('visibilitychange', naZmianeWidocznosci);
      lift();
    },
  };
}
