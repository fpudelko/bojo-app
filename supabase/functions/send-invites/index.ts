import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Verify caller is authenticated
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey    = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
  if (authErr || !caller) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Rate limit: max 20 invite batches per hour
  const { data: allowed } = await callerClient.rpc('check_rate_limit', {
    p_action: 'send_invites',
    p_max_per_hour: 20,
  });
  if (allowed === false) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { recurringEventId, eventId, eventDate, eventUrl } = await req.json();

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: eventRow, error: eventErr } = await supabase
    .from('recurring_events')
    .select('*')
    .eq('id', recurringEventId)
    .single();

  if (eventErr || !eventRow) {
    return new Response(
      JSON.stringify({ error: 'Recurring event not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const { data: inviteRows, error: inviteErr } = await supabase
    .from('recurring_event_invites')
    .select('*')
    .eq('recurring_event_id', recurringEventId)
    .order('created_at', { ascending: true });

  if (inviteErr) {
    return new Response(
      JSON.stringify({ error: inviteErr.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const invites = inviteRows ?? [];
  const label = eventRow.title ?? eventRow.sport;
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const twilioFrom = Deno.env.get('TWILIO_PHONE_FROM');

  let emailsSent = 0;
  let smsSent = 0;
  const errors: string[] = [];

  for (const invite of invites) {
    if (invite.email && resendApiKey) {
      const html = `<p>Cześć ${invite.name}! Otwieramy zapisy na ${label} — ${eventDate}. Zapisz się: <a href="${eventUrl}">${eventUrl}</a></p>`;
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'noreply@bojo.app',
          to: invite.email,
          subject: `Zapisy na ${label} — ${eventDate}`,
          html,
        }),
      });
      if (res.ok) {
        emailsSent++;
      } else {
        const body = await res.text();
        errors.push(`Email to ${invite.email}: ${body}`);
      }
    }

    if (invite.phone && twilioSid && twilioToken && twilioFrom) {
      const message = `Cześć ${invite.name}! Zapisy na ${label} — ${eventDate}: ${eventUrl}`;
      const params = new URLSearchParams({
        From: twilioFrom,
        To: invite.phone,
        Body: message,
      });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        },
      );
      if (res.ok) {
        smsSent++;
      } else {
        const body = await res.text();
        errors.push(`SMS to ${invite.phone}: ${body}`);
      }
    }
  }

  return new Response(
    JSON.stringify({ emailsSent, smsSent, errors }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
