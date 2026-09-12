import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { type DaneAlertu, doHtml, doTekstu, tresc } from './tresc.ts';

/**
 * Alert o nowej grze w okolicy (`game_alerts`) — za flagą `SHOW_GAME_ALERTS`
 * (dziś wyłączoną), ale istniejące alerty sprzed wyłączenia flagi dalej
 * dostają maile: flaga chowa WEJŚCIE w nawigacji, nie trasę ani ten kanał.
 *
 * TREŚĆ SIEDZI W `tresc.ts` — jedno źródło dla wersji tekstowej i graficznej,
 * czyste TS bez `Deno`, więc testowane Vitestem razem z resztą repo, tym
 * samym wzorcem co `powiadom-goscia`. Tutaj zostaje wyłącznie zapytanie do
 * bazy i wysyłka.
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const resendKey   = Deno.env.get('RESEND_API_KEY');
  // Domeną kanoniczną jest `bojo.pl` — ta sama, co w `layout.tsx`, `robots.ts`
  // i `sitemap.ts`. `bojo.app` było historycznym fallbackiem i wysyłało ludzi
  // na inny adres niż ten, który widzą w przeglądarce.
  const siteUrl     = Deno.env.get('SITE_URL') ?? 'https://bojo.pl';
  const nadawca     = Deno.env.get('BOJO_NADAWCA') ?? 'Bojo <noreply@bojo.pl>';
  // Bez tego odpowiedź na maila szła donikąd — `reply_to` brakowało tu od
  // początku, mimo że `powiadom-goscia` ma go od 2026-09-08 z tego samego
  // powodu: adres z regulaminu, na który realnie ktoś czyta.
  const odpowiedzNa = Deno.env.get('BOJO_ODPOWIEDZ_NA') ?? 'bojopolska@gmail.com';

  const admin = createClient(supabaseUrl, serviceKey);

  const { eventId } = await req.json();
  if (!eventId) {
    return new Response(JSON.stringify({ error: 'Missing eventId' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const { data: event } = await admin
    .from('events')
    .select('*, fields(address)')
    .eq('id', eventId)
    .single();
  if (!event || event.visibility !== 'public' || event.status !== 'active' || !event.lat || !event.lng) {
    return new Response(JSON.stringify({ notified: 0 }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fieldAddress: string | null = (event.fields as any)?.address ?? null;

  // ISO day-of-week (1=Mon … 7=Sun)
  const d = new Date(event.event_date);
  const dow = d.getDay() === 0 ? 7 : d.getDay();

  const { data: alerts } = await admin.from('game_alerts').select('*').eq('is_active', true);

  const matching = (alerts ?? []).filter((a: any) => {
    if (a.user_id === event.organizer_id) return false; // skip organizer
    if (a.sport && a.sport !== event.sport) return false;
    if (a.days_of_week?.length > 0 && !a.days_of_week.includes(dow)) return false;
    return haversineKm(a.lat, a.lng, event.lat, event.lng) <= a.radius_km;
  });

  if (matching.length === 0) {
    return new Response(JSON.stringify({ notified: 0 }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const dane: DaneAlertu = {
    sport: event.sport, title: event.title, maxPlayers: event.max_players,
    costGrosz: event.cost_grosz, fieldName: event.field_name, fieldAddress,
    customLocationName: event.custom_location_name, customAddress: event.custom_address,
    eventDate: event.event_date, eventTime: event.event_time,
  };
  // Data w temacie — ten sam zapis co w treści, liczony raz.
  const [rok, miesiac, dzien] = String(event.event_date).split('-');
  const mail = tresc(dane, `${dzien}.${miesiac}.${rok}`);
  const eventUrl = `${siteUrl}/wydarzenia/${eventId}`;
  const kontakt = { strona: siteUrl, eventUrl, odpowiedzNa };

  // Insert in-app notifications in one batch
  await admin.from('notifications').insert(
    matching.map((a: any) => ({
      user_id:  a.user_id,
      type:     'game_alert',
      title:    `Nowa gra: ${mail.label}`,
      body:     mail.szczegoly,
      event_id: eventId,
      alert_id: a.id,
    })),
  );

  // Send emails via Resend
  let emailsSent = 0;
  if (resendKey) {
    const html = doHtml(mail, kontakt);
    const text = doTekstu(mail, kontakt);
    for (const alert of matching) {
      try {
        const { data: { user } } = await admin.auth.admin.getUserById(alert.user_id);
        if (!user?.email) continue;

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: nadawca,
            reply_to: odpowiedzNa,
            to: user.email,
            subject: mail.temat,
            html,
            text,
          }),
        });
        if (res.ok) emailsSent++;
      } catch { /* soft fail per user */ }
    }
  }

  return new Response(JSON.stringify({ notified: matching.length, emailsSent }), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
