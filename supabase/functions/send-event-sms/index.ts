import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function sendViaSmsApi(phone: string, message: string): Promise<boolean> {
  const token = Deno.env.get('SMSAPI_TOKEN');
  if (!token) return false;
  const params = new URLSearchParams({ to: phone, message, from: 'Bojo' });
  const res = await fetch('https://api.smsapi.pl/sms.do', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  return res.ok;
}

async function sendViaTwilio(phone: string, message: string): Promise<boolean> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_PHONE_FROM');
  if (!sid || !token || !from) return false;
  const params = new URLSearchParams({ From: from, To: phone, Body: message });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  return res.ok;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { type, eventId, participantId } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const [{ data: participant }, { data: event }] = await Promise.all([
      supabase.from('event_participants').select('name, phone').eq('id', participantId).single(),
      supabase.from('events').select('title, sport, event_date, event_time, field_name').eq('id', eventId).single(),
    ]);

    if (!participant || !event) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!participant.phone) {
      return new Response(JSON.stringify({ error: 'No phone number' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const label = event.title ?? event.sport;
    const date = event.event_date;
    const time = (event.event_time as string)?.slice(0, 5);
    const venue = event.field_name;

    let message: string;
    if (type === 'confirmation') {
      message = `Cześć ${participant.name}! Zapraszamy na ${label} — ${date} ${time}, ${venue}. Odpowiedz SMS: TAK lub NIE.`;
    } else if (type === 'removal') {
      message = `Cześć ${participant.name}! Zostałeś usunięty z listy: ${label} — ${date} ${time}.`;
    } else {
      return new Response(JSON.stringify({ error: 'Unknown type' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sent = await sendViaSmsApi(participant.phone, message) ||
                 await sendViaTwilio(participant.phone, message);

    if (!sent) {
      return new Response(JSON.stringify({ error: 'Brak skonfigurowanego dostawcy SMS' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
