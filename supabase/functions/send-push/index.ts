import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

/**
 * Wysyłka powiadomień push.
 *
 * KTO TO WOŁA: wyzwalacz `trg_wyslij_push` na tabeli `notifications`
 * (migracja `102`), przez `pg_net`. Nie aplikacja — powiadomienia powstają
 * w bazie, z wyzwalaczy, i aplikacja często nawet nie wie, że powstały
 * (mecz zakłada jedna osoba, powiadomienia dostaje dziesięć).
 *
 * UWIERZYTELNIENIE nagłówkiem `x-bojo-sekret`, nie tokenem użytkownika:
 * wołający jest bazą danych, nie człowiekiem. Sekret siedzi w tabeli
 * `konfiguracja_push` (RLS bez polityk, więc przez API nieczytelna)
 * i w zmiennych funkcji. Funkcja MUSI być wdrożona z `--no-verify-jwt`,
 * inaczej Supabase odrzuci wywołanie z bazy, zanim ono tu dotrze.
 *
 * WYMAGANE ZMIENNE (Supabase → Edge Functions → Secrets):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...),
 *   BOJO_PUSH_SEKRET  — ta sama wartość co w `konfiguracja_push`.
 */

const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:kontakt@bojo.pl';
const SEKRET        = Deno.env.get('BOJO_PUSH_SEKRET') ?? '';

/** Dokąd prowadzi kliknięcie w powiadomienie. Ta sama logika co
 *  `celPowiadomienia()` w `NotificationBell.tsx` — powiadomienie na telefonie
 *  ma otwierać dokładnie to samo miejsce co powiadomienie w aplikacji. */
function adresPowiadomienia(dane: Record<string, unknown>): string {
  if (dane.event_id) return `/wydarzenia/${dane.event_id}`;
  if (dane.group_id) return `/grupy/${dane.group_id}`;
  return '/';
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  if (!SEKRET || req.headers.get('x-bojo-sekret') !== SEKRET) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    // Brak kluczy to błąd wdrożenia, nie żądania — logujemy i wychodzimy
    // z 200, żeby `pg_net` nie ponawiał w nieskończoność.
    console.error('[send-push] brak kluczy VAPID');
    return new Response(JSON.stringify({ pominiete: 'brak kluczy' }), { status: 200 });
  }

  const dane = await req.json().catch(() => null);
  if (!dane?.user_id) {
    return new Response('Bad request', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: subskrypcje, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', dane.user_id);

  if (error) {
    console.error('[send-push] odczyt subskrypcji', error.message);
    return new Response('DB error', { status: 500 });
  }
  if (!subskrypcje || subskrypcje.length === 0) {
    // Nikt z tego konta nie włączył pusha — to normalny przypadek, nie błąd.
    return new Response(JSON.stringify({ wyslane: 0 }), { status: 200 });
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  const tresc = JSON.stringify({
    tytul: dane.tytul ?? 'Bojo',
    tresc: dane.tresc ?? '',
    adres: adresPowiadomienia(dane),
    // `tag` po meczu: kolejne powiadomienie o tym samym meczu PODMIENIA
    // poprzednie zamiast układać stos pięciu (patrz `public/sw.js`).
    tag: dane.event_id ? `mecz-${dane.event_id}` : dane.group_id ? `ekipa-${dane.group_id}` : 'bojo',
  });

  const martwe: string[] = [];
  const zywe: string[] = [];

  await Promise.all(subskrypcje.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        tresc,
      );
      zywe.push(s.id);
    } catch (e) {
      // 404/410 = subskrypcja wygasła albo użytkownik odinstalował aplikację.
      // Taki wiersz nigdy już nie zadziała, więc kasujemy go od razu — inaczej
      // tabela puchnie o martwe adresy, a każda wysyłka próbuje ich na nowo.
      const status = (e as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) martwe.push(s.id);
      else console.error('[send-push] wysyłka', status, (e as Error)?.message);
    }
  }));

  if (martwe.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', martwe);
  }
  if (zywe.length > 0) {
    await supabase.from('push_subscriptions')
      .update({ last_ok_at: new Date().toISOString() })
      .in('id', zywe);
  }

  return new Response(
    JSON.stringify({ wyslane: zywe.length, skasowane: martwe.length }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
