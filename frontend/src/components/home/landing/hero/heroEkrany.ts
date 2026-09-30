/**
 * Znaczniki ekranów telefonu z animacji na pierwszym ekranie strony głównej.
 *
 * To OBRAZEK aplikacji (kreator, strona meczu, skład, rozliczenie), nie jej
 * interfejs, więc jest zwykłym łańcuchem HTML wstawianym po zamontowaniu:
 * silnik (`heroSilnik.ts`) steruje nim przez DOM, tak jak sterowała makieta,
 * na której został zweryfikowany. Przepisanie na JSX dałoby ~600 linii
 * znaczników bez zysku, bo nic tu nie reaguje na stan Reacta.
 *
 * Łańcuch jest stały (bez danych użytkownika), więc wstawienie go przez
 * `innerHTML` nie otwiera drogi do wstrzyknięcia. Jedyne wartości zmienne to
 * daty z `lib/datyHero.ts`; liczone są od dziś po zamontowaniu, żeby
 * „czwartek, 1 października” nie zestarzało się po pierwszym października.
 *
 * Profil organizatora ma inicjał „M”, a organizator w składzie nazywa się
 * „Marek Sikora”: inicjał w nagłówku i nazwisko na liście graczy muszą się
 * zgadzać (`heroSilnik.ts`, ROSTER).
 *
 * Symbole ikon mają prefiks `ha-ic-`, żeby nie zderzyć się z niczym
 * w dokumencie.
 */
import type { DatyHero } from '@/lib/datyHero';

export const SPRITE_IKON = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <symbol id="ha-ic-bell" viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></symbol>
  <symbol id="ha-ic-back" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></symbol>
  <symbol id="ha-ic-cal" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></symbol>
  <symbol id="ha-ic-pin" viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></symbol>
  <symbol id="ha-ic-share" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></symbol>
  <symbol id="ha-ic-send" viewBox="0 0 24 24"><path d="m3 11 19-9-9 19-2-8-8-2z"/></symbol>
  <symbol id="ha-ic-users" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></symbol>
  <symbol id="ha-ic-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></symbol>
  <symbol id="ha-ic-tag" viewBox="0 0 24 24"><path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1"/></symbol>
  <symbol id="ha-ic-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></symbol>
  <symbol id="ha-ic-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
  <symbol id="ha-ic-uplus" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></symbol>
  <symbol id="ha-ic-ux" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 8 5 5M22 8l-5 5"/></symbol>
  <symbol id="ha-ic-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></symbol>
  <symbol id="ha-ic-lock" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></symbol>
  <symbol id="ha-ic-map" viewBox="0 0 24 24"><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></symbol>
  <symbol id="ha-ic-chat" viewBox="0 0 24 24"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></symbol>
  <symbol id="ha-ic-comp" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2 6.4-6.4 2 2-6.4z"/></symbol>
  <symbol id="ha-ic-ucirc" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.7a6 6 0 0 1 10 0"/></symbol>
  <symbol id="ha-ic-copy" viewBox="0 0 24 24"><rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"/></symbol>
  <symbol id="ha-ic-chev" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
  <symbol id="ha-ic-chr" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></symbol>
  <symbol id="ha-ic-home" viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></symbol>
  <symbol id="ha-ic-dots" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></symbol>
  <symbol id="ha-ic-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7"/></symbol>
  <symbol id="ha-ic-moon" viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></symbol>
  <symbol id="ha-ic-trash" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></symbol>
  <symbol id="ha-ic-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></symbol>
  <symbol id="ha-ic-link" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></symbol>
  <symbol id="ha-ic-shuf" viewBox="0 0 24 24"><path d="M2 18h1.4a4 4 0 0 0 3.3-1.7l6.6-8.6A4 4 0 0 1 16.6 6H22M18 2l4 4-4 4M2 6h1.9a4 4 0 0 1 3.3 1.8M22 18h-5.4a4 4 0 0 1-3.3-1.7l-.7-1M18 14l4 4-4 4"/></symbol>
  <symbol id="ha-ic-x" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></symbol>
  <symbol id="ha-ic-cash" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></symbol>
  <symbol id="ha-ic-eye" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></symbol>
  <symbol id="ha-ic-nav" viewBox="0 0 24 24"><path d="m3 11 19-9-9 19-2-8z"/></symbol>
</svg>`;

export function ekranyHtml(d: DatyHero): string {
  return `<div class="scr on" id="s-w1">
                <div class="ab"><span class="lg">bojo</span><i class="sp"></i><span class="bell"><svg class="i"><use href="#ha-ic-bell"/></svg></span><span class="av">M</span></div>
                <div class="stp"><span class="n on">1</span><span class="n">2</span><span class="n">3</span><b>Kiedy</b></div>
                <div class="vp"><div class="in" id="w1-in">
                  <div class="chips" style="flex-wrap:nowrap;overflow:hidden"><span class="chip big" id="w1-sport">⚽ Piłka nożna</span><span class="chip big">🏐 Siatkówka</span><span class="chip big">🏀</span></div>
                  <span class="lbl">Data</span>
                  <div class="sel" id="w1-date"><span class="v"></span><svg class="i"><use href="#ha-ic-chev"/></svg></div>
                  <div class="hint" id="w1-dh"></div>
                  <div class="r2">
                    <div><span class="lbl">Rozpoczęcie</span><div class="hm"><div class="sel" id="w1-h"><span class="v"></span></div><b>:</b><div class="sel"><span class="v">00</span></div></div></div>
                    <div><span class="lbl">Czas gry</span><div class="sel"><span class="v">90 min</span><svg class="i"><use href="#ha-ic-chev"/></svg></div><div class="hint" id="w1-end"></div></div>
                  </div>
                  <span class="lbl">Liczba miejsc</span>
                  <div class="stepper"><span>–</span><b id="w1-max"></b><span id="w1-plus">+</span></div>
                  <div class="hint">Kolejni chętni trafią na listę rezerwową.</div>
                  <div class="opt"><div class="oh"><div><b>Lista rezerwowa</b><p>Przy komplecie kolejni chętni czekają w kolejce i wchodzą, gdy ktoś się wypisze.</p></div><span class="tog on"></span></div></div>
                  <div class="opt" id="w1-paid">
                    <div class="oh"><div><b>Mecz płatny</b><p>Podziel koszt między graczy.</p></div><span class="tog" id="w1-ptog"></span></div>
                    <div class="more" id="w1-more">
                      <span class="lbl">Koszt wynajmu obiektu (zł)</span>
                      <div class="inp" id="w1-cost"><span class="v"></span></div>
                      <div class="hint" id="w1-calc">&nbsp;</div>
                      <span class="lbl">Jak można zapłacić?</span>
                      <div class="chips"><span class="chip" id="w1-blik">BLIK</span><span class="chip" id="w1-cash">Gotówka</span></div>
                    </div>
                  </div>
                </div></div>
                <div class="foot"><div class="btn" id="w1-next">Dalej →</div></div>
              </div>
              <div class="scr" id="s-w2">
                <div class="ab"><span class="lg">bojo</span><i class="sp"></i><span class="bell"><svg class="i"><use href="#ha-ic-bell"/></svg></span><span class="av">M</span></div>
                <div class="stp"><span class="n dn"><svg class="i s"><use href="#ha-ic-check"/></svg></span><span class="n on">2</span><span class="n">3</span><b>Gdzie</b></div>
                <div class="vp"><div class="in">
                  <span class="lbl" style="margin-top:2px">Lokalizacja</span>
                  <div class="hint" style="margin:-2px 0 10px">Wyszukaj adres lub boisko, albo wskaż miejsce na mapie.</div>
                  <div class="inp" id="w2-q"><span class="v"></span><svg class="i" style="color:#555"><use href="#ha-ic-search"/></svg></div>
                  <div class="sugg" id="w2-sugg">
                    <div id="w2-s1"><svg class="i" style="color:var(--g)"><use href="#ha-ic-pin"/></svg><span><b>Boisko Grunwald</b><br><small style="color:#6b7280">ul. Grunwaldzka 22, Poznań</small></span></div>
                    <div><svg class="i"><use href="#ha-ic-pin"/></svg>Grunwald, Poznań</div>
                  </div>
                  <div class="map">
                    <svg viewBox="0 0 328 240" preserveAspectRatio="none">
                      <rect width="328" height="240" fill="#EEF0EA"/>
                      <path d="M0 165 C80 145 120 195 200 175 S300 115 328 125 L328 155 C290 145 240 205 200 205 S90 175 0 195Z" fill="#CFE3F2"/>
                      <circle cx="70" cy="58" r="38" fill="#D7EAD3"/><circle cx="270" cy="205" r="30" fill="#D7EAD3"/>
                      <g stroke="#fff" stroke-width="7" fill="none"><path d="M0 108 L328 78"/><path d="M180 0 L150 240"/><path d="M40 0 L110 240"/><path d="M250 0 L300 240"/></g>
                      <path d="M0 38 L328 18" stroke="#F4D9A6" stroke-width="5" fill="none"/>
                      <text x="208" y="58" font-family="Inter" font-size="15" font-weight="700" fill="#6C7280">Grunwald</text>
                    </svg>
                    <span class="cl" style="left:30px;top:118px">12</span><span class="cl" style="left:252px;top:108px">8</span><span class="cl" style="left:110px;top:28px">5</span>
                    <svg class="mpin" id="w2-pin" viewBox="0 0 36 46"><path d="M18 45C18 45 3 28 3 17a15 15 0 0 1 30 0c0 11-15 28-15 28z" fill="#1B6B3F" stroke="#fff" stroke-width="2.5"/><circle cx="18" cy="17" r="6" fill="#fff"/></svg>
                  </div>
                  <div class="picked" id="w2-pick"><svg class="i"><use href="#ha-ic-pin"/></svg><div><b>Boisko Grunwald, Poznań</b><div class="hint" style="margin:0">ul. Grunwaldzka 22</div></div></div>
                </div></div>
                <div class="foot"><div class="btn ghost">← Wróć</div><div class="btn" id="w2-next">Dalej →</div></div>
              </div>
              <div class="scr" id="s-w3">
                <div class="ab"><span class="lg">bojo</span><i class="sp"></i><span class="bell"><svg class="i"><use href="#ha-ic-bell"/></svg></span><span class="av">M</span></div>
                <div class="stp"><span class="n dn"><svg class="i s"><use href="#ha-ic-check"/></svg></span><span class="n dn"><svg class="i s"><use href="#ha-ic-check"/></svg></span><span class="n on">3</span><b>Dla kogo</b></div>
                <div class="vp"><div class="in">
                  <span class="lbl" style="margin-top:2px">Widoczność</span>
                  <div class="vis">
                    <div class="on"><b><svg class="i s"><use href="#ha-ic-globe"/></svg>Publiczne</b>Widoczne dla wszystkich, dołączy każdy chętny</div>
                    <div><b><svg class="i s"><use href="#ha-ic-lock"/></svg>Prywatne</b>Nie pojawia się na liście, wejdzie tylko ktoś z linkiem</div>
                  </div>
                  <div class="opt" style="background:#fff;border-color:var(--bd)"><div class="oh"><div><b>Wymagaj akceptacji</b><p>Każdą prośbę o dołączenie zatwierdzasz ręcznie.</p></div><span class="tog"></span></div></div>
                  <span class="lbl">Dodaj do grupy <em>(opcjonalnie)</em></span>
                  <div class="sel" style="background:#fff"><span class="v" style="color:#6b7280">Wybierz grupę</span><svg class="i"><use href="#ha-ic-chr"/></svg></div>
                  <span class="lbl">Tytuł <em>(opcjonalnie)</em></span>
                  <div class="inp" id="w3-title"><span class="v"></span></div>
                </div></div>
                <div class="foot"><div class="btn ghost">← Wróć</div><div class="btn" id="w3-next">Sprawdź i opublikuj →</div></div>
                <div class="dim" id="w3-dim"></div>
                <div class="dlg" id="w3-dlg">
                  <h3>Sprawdź mecz przed publikacją</h3>
                  <div class="sub">Po opublikowaniu mecz od razu jest widoczny.</div>
                  <div class="sum">
                    <div class="h">Tak zobaczą to gracze</div>
                    <div class="r"><span class="k">CO</span><span>Czwartkowa ligówka</span><span class="z">Zmień</span></div>
                    <div class="r"><span class="k">KIEDY</span><span>${d.celDluga} · 18:00–19:30</span><span class="z">Zmień</span></div>
                    <div class="r"><span class="k">GDZIE</span><span>Boisko Grunwald, Poznań</span><span class="z">Zmień</span></div>
                    <div class="r"><span class="k">SKŁAD</span><span>14 miejsc · grasz</span><span class="z">Zmień</span></div>
                    <div class="r"><span class="k">KOSZT</span><span>15,00 zł od osoby</span><span class="z">Zmień</span></div>
                  </div>
                  <div class="dbtns"><div class="btn ghost sm">Wróć do edycji</div><div class="btn sm" id="w3-go">Opublikuj mecz</div></div>
                </div>
              </div>
              <div class="scr" id="s-ready">
                <div class="ab"><span class="lg">bojo</span><i class="sp"></i><span class="bell"><svg class="i"><use href="#ha-ic-bell"/></svg></span><span class="av">M</span></div>
                <div class="ttl"><h2><svg class="i"><use href="#ha-ic-back"/></svg>Czwartkowa ligówka</h2>
                  <div class="tabs"><span class="on">Mecz</span><span>Rozmowa</span><span>Rozliczenia</span><span>Ustawienia</span></div></div>
                <div class="vp"><div class="in">
                  <div class="ready"><h4>Mecz gotowy <span>✕</span></h4>
                    <div class="btn" id="rd-share"><svg class="i"><use href="#ha-ic-share"/></svg>Wyślij link znajomym</div>
                    <p>Wrzuć link na grupę, a gracze zapiszą się sami.</p></div>
                  <div class="req"><b><svg class="i s"><use href="#ha-ic-uplus"/></svg>Prośby o dołączenie</b>Na razie nikt nie czeka na akceptację.</div>
                  <div class="card">
                    <div class="row2"><svg class="i"><use href="#ha-ic-cal"/></svg><div class="when"><b>${d.celDlugaWielka}</b> · 18:00–19:30 <span class="m">· 90 min</span></div></div>
                    <div class="row2"><svg class="i"><use href="#ha-ic-pin"/></svg><div class="place" style="color:var(--g)"><u>Boisko Grunwald</u><small>ul. Grunwaldzka 22, Poznań</small></div></div>
                  </div>
                </div></div>
                <div class="inme">Jesteś w składzie <b>Wypisz się</b></div>
                <div class="bn"><span><svg class="i"><use href="#ha-ic-cal"/></svg>Mecze<em style="background:var(--g)">4</em></span><span><svg class="i"><use href="#ha-ic-comp"/></svg>Szukaj</span><span style="opacity:0">.</span><span><svg class="i"><use href="#ha-ic-chat"/></svg>Rozmowy</span><span><svg class="i"><use href="#ha-ic-users"/></svg>Ekipy</span><div class="fab"><svg class="i"><use href="#ha-ic-plus"/></svg></div></div>
                <div class="dim" id="rd-dim"></div>
                <div class="sheet" id="rd-sheet">
                  <div class="sh-p"><span class="ico">b</span><div><b>⚽ Czwartkowa ligówka</b><small>www.bojo.pl</small></div></div>
                  <div class="sh-g">
                    <span id="rd-wa"><i style="background:#25D366">✆</i>WhatsApp</span>
                    <span><i style="background:#fff;color:#EA4335;border:1px solid #eee">M</i>Gmail</span>
                    <span><i style="background:linear-gradient(135deg,#0A7CFF,#A033FF)">m</i>Czaty</span>
                    <span><i style="background:#eee;color:#333">⋯</i>Więcej</span>
                  </div>
                </div>
              </div>
              <div class="scr" id="s-wa">
                <div class="wa-h"><svg class="i"><use href="#ha-ic-back"/></svg><div class="wa-av">⚽</div>
                  <div><div class="wa-t">Czwartkowa gierka</div><div class="wa-s">Kuba, Ola, Bartek, Szymon, Ty i 9 innych</div></div></div>
                <div class="chat" id="chat"></div>
                <div class="wa-in"><div>Wiadomość</div><span><svg class="i"><use href="#ha-ic-send"/></svg></span></div>
              </div>
              <div class="scr" id="s-guest">
                <div class="cr"><svg class="i"><use href="#ha-ic-home"/></svg><div class="url">bojo.pl<span>/wydarzenia/5ebe…</span></div><span class="tabn">3</span><svg class="i"><use href="#ha-ic-dots"/></svg></div>
                <div class="site"><span class="lgb">bojo</span><i style="flex:1"></i><svg class="i"><use href="#ha-ic-map"/></svg><span class="dj">Dołącz</span><svg class="i" style="width:28px;height:28px"><use href="#ha-ic-ucirc"/></svg></div>
                <div class="ttl"><h2><svg class="i"><use href="#ha-ic-back"/></svg>Czwartkowa ligówka</h2><div class="tabs"><span class="on">Mecz</span><span>Rozmowa</span><span>Rozliczenia</span></div></div>
                <div class="vp"><div class="in">
                  <div class="chips" style="margin-bottom:12px"><span class="pill a"><svg class="i s"><use href="#ha-ic-tag"/></svg>15 zł / os.</span><span class="pill g"><svg class="i s"><use href="#ha-ic-globe"/></svg>Publiczne</span></div>
                  <div class="card">
                    <div class="cap2">KIEDY I GDZIE</div>
                    <div class="row2"><svg class="i"><use href="#ha-ic-cal"/></svg><div class="when"><b>${d.celDlugaWielka}</b> · 18:00–19:30</div></div>
                    <div class="row2"><svg class="i"><use href="#ha-ic-pin"/></svg><div class="place">Boisko Grunwald<small>ul. Grunwaldzka 22, Poznań</small></div></div>
                  </div>
                  <div class="card cnt"><div class="big" id="g-big"></div><div class="bar"><i id="g-bar"></i></div><div class="left" id="g-left"></div></div>
                </div></div>
                <div class="gfoot" id="g-foot"><div class="btn am" id="g-join">Dołącz bez konta →</div><div class="btn sl">Zaloguj się</div></div>
                <div class="gfoot2" id="g-foot2"><div><b>Jesteś zapisany(a)</b><small>Zapis bez konta: zarządzasz nim linkiem</small></div><div class="btn">Mój zapis →</div></div>
                <div class="toast" id="g-toast" style="top:128px"><svg class="i s"><use href="#ha-ic-check"/></svg>Dołączyłeś do meczu!</div>
                <div class="dim" id="g-dim"></div>
                <div class="dlg" id="g-dlg">
                  <h3>Dołącz do meczu bez logowania</h3>
                  <div class="sub">⚽ Czwartkowa ligówka · Boisko Grunwald</div>
                  <div class="ul">IMIĘ I NAZWISKO</div><div class="inp" id="g-name"><span class="v"></span></div>
                  <div class="ul">E-MAIL</div><div class="inp" id="g-mail"><span class="v"></span></div>
                  <div class="hint">Bez hasła i bez zakładania konta.</div>
                  <div class="ul">TWOJA ROLA</div><div class="roles"><span class="on">⚽ Zawodnik</span><span>🧤 Bramkarz</span></div>
                  <div class="ul">JAK ZAPŁACISZ?</div><div class="chips"><span class="chip" id="g-blik">BLIK</span></div>
                  <div class="costbox"><span>Koszt</span><b>15,00 zł</b></div>
                  <div class="dbtns"><div class="btn ghost sm">Anuluj</div><div class="btn sm" id="g-save">Zapisz się</div></div>
                </div>
              </div>
              <div class="scr" id="s-org">
                <div class="ab"><span class="lg">bojo</span><i class="sp"></i><span class="bell"><svg class="i"><use href="#ha-ic-bell"/></svg><em>2</em></span><span class="av">M</span></div>
                <div class="ttl"><h2><svg class="i"><use href="#ha-ic-back"/></svg>Czwartkowa ligówka</h2>
                  <div class="tabs"><span class="on">Mecz</span><span>Taktyka</span><span>Rozmowa<i class="badge">3</i></span><span>Rozliczenia</span><span>Ustawienia</span></div></div>
                <div class="vp"><div class="in" id="o-in">
                  <div class="card cnt"><div class="big" id="o-big"></div><div class="bar" id="o-barw"><i id="o-bar"></i></div><div class="left" id="o-left"></div>
                    <div class="sub" id="o-sub">dla wszystkich ról, w tym do 1 dla bramkarza</div>
                    <div class="stack" id="o-stack" style="display:none"></div>
                    <div class="ft"><span id="o-hd"></span><span><svg class="i xs"><use href="#ha-ic-share"/></svg>Wyślij skład</span></div></div>
                  <div class="card ros">
                    <div id="o-rows"></div>
                    <div class="addp" id="o-add"><svg class="i s"><use href="#ha-ic-uplus"/></svg>Dopisz osobę bez konta</div>
                    <div class="res" id="o-res"><div class="hd">REZERWA: KOLEJKA DO ZWOLNIONEGO MIEJSCA</div><div id="o-resrows"></div></div>
                  </div>
                </div></div>
                <div class="inme">Jesteś w składzie <b>Wypisz się</b></div>
                <div class="bn"><span><svg class="i"><use href="#ha-ic-cal"/></svg>Mecze<em style="background:var(--g)">4</em></span><span><svg class="i"><use href="#ha-ic-comp"/></svg>Szukaj</span><span style="opacity:0">.</span><span><svg class="i"><use href="#ha-ic-chat"/></svg>Rozmowy<em style="background:#E11D74">3</em></span><span><svg class="i"><use href="#ha-ic-users"/></svg>Ekipy</span><div class="fab"><svg class="i"><use href="#ha-ic-plus"/></svg></div></div>
                <div class="dim" id="o-dim"></div>
                <div class="dlg" id="o-dlg">
                  <h3>Dopisz osobę bez konta <span>✕</span></h3>
                  <div class="inp focus" id="o-name" style="margin-top:12px"><span class="v"></span></div>
                  <div class="inp" style="margin-top:10px"><span class="v ph">E-mail znajomego (opcjonalnie)</span></div>
                  <div class="chips" style="margin-top:12px"><span class="chip ok" style="padding:7px 11px">Zawodnik z pola</span><span class="chip" style="padding:7px 11px">🧤 Bramkarz</span></div>
                  <div class="btn sm" id="o-addok" style="margin-top:14px"><svg class="i s"><use href="#ha-ic-uplus"/></svg>Dodaj</div>
                </div>
                <div class="sheet" id="o-sheet">
                  <h3 style="margin:0 0 8px;font-size:18px;display:flex;justify-content:space-between">Dodano „Kuba” do składu ✓ <span style="color:#9aa1ab;font-weight:400">✕</span></h3>
                  <p style="margin:0 0 14px;font-size:13.5px;color:var(--mut);line-height:1.45">Wyślij mu link do jego zapisu. Bez zakładania konta sprawdzi tam skład i koszt, a jeśli coś wypadnie, sam się wypisze.</p>
                  <div class="btn sm"><svg class="i s"><use href="#ha-ic-share"/></svg>Wyślij link do zapisu</div>
                  <div style="text-align:center;margin-top:12px;font-weight:600;font-size:14px;color:#4B5563">Dodaj kolejnego</div>
                </div>
              </div>
              <div class="scr" id="s-sk">
                <div class="ab"><span class="lg">bojo</span><i class="sp"></i><span class="bell"><svg class="i"><use href="#ha-ic-bell"/></svg><em>2</em></span><span class="av">M</span></div>
                <div class="ttl"><h2><svg class="i"><use href="#ha-ic-back"/></svg>Czwartkowa ligówka</h2>
                  <div class="tabs"><span class="on">Mecz</span><span>Taktyka</span><span>Rozmowa<i class="badge">3</i></span><span>Rozliczenia</span><span>Ustawienia</span></div></div>
                <div class="vp"><div class="in" id="k-in">
                  <div class="card">
                    <div class="sk-h"><svg class="i"><use href="#ha-ic-shuf"/></svg>Składy <span style="font-weight:400;color:var(--mut2);font-size:13px">(Ręcznie)</span><span class="vs" id="k-vs"><b>0</b> vs <i>0</i></span></div>
                    <div class="oh" style="margin-top:12px;align-items:center"><div style="display:flex;gap:10px;align-items:center"><svg class="i" style="color:#6b7280"><use href="#ha-ic-eye"/></svg><div><b style="font-size:14.5px">Opublikuj składy</b><p>Gracze widzą podział na drużyny</p></div></div><span class="tog on"></span></div>
                    <div class="sk-btns"><span id="k-rand"><svg class="i s"><use href="#ha-ic-shuf"/></svg>Losuj skład</span><span><svg class="i s"><use href="#ha-ic-x"/></svg>Wyczyść</span><span><svg class="i s"><use href="#ha-ic-x"/></svg>Wyłącz skład</span></div>
                    <div class="pool" id="k-pool"></div>
                    <div class="tgrid" id="k-grid">
                      <div class="team b"><span class="cnt2" id="k-nb">0</span><div id="k-b"></div></div>
                      <div class="team r"><span class="cnt2" id="k-nr">0</span><div id="k-r"></div></div>
                    </div>
                  </div>
                </div></div>
                <div class="inme">Jesteś w składzie <b>Wypisz się</b></div>
                <div class="bn"><span><svg class="i"><use href="#ha-ic-cal"/></svg>Mecze<em style="background:var(--g)">4</em></span><span><svg class="i"><use href="#ha-ic-comp"/></svg>Szukaj</span><span style="opacity:0">.</span><span><svg class="i"><use href="#ha-ic-chat"/></svg>Rozmowy<em style="background:#E11D74">3</em></span><span><svg class="i"><use href="#ha-ic-users"/></svg>Ekipy</span><div class="fab"><svg class="i"><use href="#ha-ic-plus"/></svg></div></div>
              </div>
              <div class="scr" id="s-pay">
                <div class="ab"><span class="lg">bojo</span><i class="sp"></i><span class="bell"><svg class="i"><use href="#ha-ic-bell"/></svg><em>2</em></span><span class="av">M</span></div>
                <div class="ttl"><h2><svg class="i"><use href="#ha-ic-back"/></svg>Czwartkowa ligówka</h2>
                  <div class="tabs"><span>Mecz</span><span>Taktyka</span><span>Rozmowa</span><span>Wynik</span><span class="on">Rozliczenia</span></div></div>
                <div class="vp"><div class="in">
                  <div class="card">
                    <div class="sk-h" style="margin-bottom:10px"><svg class="i"><use href="#ha-ic-cash"/></svg>Podział kosztów</div>
                    <div class="pk"><span>Koszt / os.</span><b>15,00 zł</b></div>
                    <div class="pk"><span>Opłaconych</span><b class="gr" id="p-cnt"></b></div>
                    <div class="pk"><span>Zebrano</span><b><span id="p-sum"></span> <small>z 195,00 zł</small></b></div>
                    <div class="btn ghost sm" style="margin:12px 0 6px">Wszyscy oddali</div>
                    <div class="pay"><span class="ai lt">M</span><span class="nm2">Ty <small style="display:inline">· płaci za obiekt</small></span><small style="color:var(--mut2)">15,00 zł</small></div>
                    <div id="p-rows"></div>
                  </div>
                </div></div>
                <div class="bn"><span><svg class="i"><use href="#ha-ic-cal"/></svg>Mecze<em style="background:var(--g)">4</em></span><span><svg class="i"><use href="#ha-ic-comp"/></svg>Szukaj</span><span style="opacity:0">.</span><span><svg class="i"><use href="#ha-ic-chat"/></svg>Rozmowy<em style="background:#E11D74">3</em></span><span><svg class="i"><use href="#ha-ic-users"/></svg>Ekipy</span><div class="fab"><svg class="i"><use href="#ha-ic-plus"/></svg></div></div>
                <div class="toast" id="p-toast" style="top:118px"><svg class="i s"><use href="#ha-ic-check"/></svg><span id="p-tt"></span></div>
              </div>
              <div class="scr" id="s-after">
                <div class="ab"><span class="lg">bojo</span><i class="sp"></i><span class="bell"><svg class="i"><use href="#ha-ic-bell"/></svg><em>2</em></span><span class="av">M</span></div>
                <div class="ttl"><h2><svg class="i"><use href="#ha-ic-back"/></svg>Czwartkowa ligówka</h2>
                  <div class="tabs"><span class="on">Mecz</span><span>Taktyka</span><span>Rozmowa</span><span>Wynik</span><span>Rozliczenia</span></div></div>
                <div class="vp"><div class="in">
                  <div class="card" id="a-card">
                    <div style="font-weight:700;font-size:17px;margin-bottom:6px">Po meczu</div>
                    <div id="a-rows"></div>
                    <div class="amb"><span><svg class="i xs"><use href="#ha-ic-ux"/></svg>Nieobecni</span><span><svg class="i xs"><use href="#ha-ic-cash"/></svg>Zapłacili</span><span><svg class="i xs"><use href="#ha-ic-copy"/></svg>Powtórz</span></div>
                  </div>
                  <div class="card" id="a-score" style="opacity:0;transition:opacity .4s">
                    <div class="sk-h">🏆 Wynik meczu</div>
                    <div class="score"><b>6:4</b><div>Niebiescy · Czerwoni</div></div>
                  </div>
                  <div class="chips"><span class="pill gd">☆ Organizujesz</span><span class="pill a" id="a-pill"><svg class="i s"><use href="#ha-ic-cash"/></svg>1 osoba nie zapłaciła</span></div>
                </div></div>
                <div class="bn"><span><svg class="i"><use href="#ha-ic-cal"/></svg>Mecze<em style="background:var(--g)">4</em></span><span><svg class="i"><use href="#ha-ic-comp"/></svg>Szukaj</span><span style="opacity:0">.</span><span><svg class="i"><use href="#ha-ic-chat"/></svg>Rozmowy<em style="background:#E11D74">3</em></span><span><svg class="i"><use href="#ha-ic-users"/></svg>Ekipy</span><div class="fab"><svg class="i"><use href="#ha-ic-plus"/></svg></div></div>
              </div>

              <div class="finger" id="finger"></div>`;
}
