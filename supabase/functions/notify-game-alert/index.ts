import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  const siteUrl     = Deno.env.get('SITE_URL') ?? 'https://bojo.app';

  const admin = createClient(supabaseUrl, serviceKey);

  const { eventId } = await req.json();
  if (!eventId) {
    return new Response(JSON.stringify({ error: 'Missing eventId' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const { data: event } = await admin.from('events').select('*').eq('id', eventId).single();
  if (!event || event.visibility !== 'public' || event.status !== 'active' || !event.lat || !event.lng) {
    return new Response(JSON.stringify({ notified: 0 }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

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

  const label    = event.title || `${event.sport} — ${event.field_name}`;
  const eventUrl = `${siteUrl}/wydarzenie/${eventId}`;

  // Insert in-app notifications in one batch
  await admin.from('notifications').insert(
    matching.map((a: any) => ({
      user_id:  a.user_id,
      type:     'game_alert',
      title:    `Nowa gra: ${label}`,
      body:     `${event.event_date} o ${event.event_time} · ${event.field_name}`,
      event_id: eventId,
      alert_id: a.id,
    })),
  );

  // Send emails via Resend
  let emailsSent = 0;
  if (resendKey) {
    for (const alert of matching) {
      try {
        const { data: { user } } = await admin.auth.admin.getUserById(alert.user_id);
        if (!user?.email) continue;

        const html = `
<p style="font-family:sans-serif;color:#1a1d21">Cześć!</p>
<p style="font-family:sans-serif;color:#1a1d21">Pojawiła się nowa gra pasująca do Twojego alertu:</p>
<div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:16px 0;font-family:sans-serif">
  <p style="font-weight:700;font-size:16px;margin:0 0 8px">${label}</p>
  <p style="color:#64748b;margin:0">📅 ${event.event_date} o ${event.event_time}</p>
  <p style="color:#64748b;margin:4px 0 0">📍 ${event.field_name}</p>
</div>
<a href="${eventUrl}" style="display:inline-block;background:#15803d;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-family:sans-serif;font-weight:600">
  Zobacz mecz →
</a>
<p style="font-family:sans-serif;color:#94a3b8;font-size:12px;margin-top:24px">
  Zarządzaj alertami na <a href="${siteUrl}" style="color:#94a3b8">bojo.app</a>
</p>`;

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from:    'Bojo <noreply@bojo.app>',
            to:      user.email,
            subject: `Alert: ${label} — ${event.event_date}`,
            html,
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
