// ============================================================
// Supabase Edge Function: send-reply
// Called from admin.js with the CALLER's access token. Sends the
// admin's reply to the customer's email via Resend, then marks
// the inquiry as 'responded'.
// Deploy with: supabase functions deploy send-reply
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM_EMAIL = Deno.env.get('ALERT_FROM_EMAIL') ?? 'support@nebro.co.tz';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  // Any authenticated staff member can reply — this checks they're signed in,
  // not a specific role (replying to customers is routine, lower-risk work).
  const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !caller) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 });
  }

  const { inquiryId, message } = await req.json();
  if (!inquiryId || !message) {
    return new Response(JSON.stringify({ error: 'inquiryId and message are required' }), { status: 400 });
  }

  const { data: inquiry, error: fetchError } = await callerClient
    .from('inquiries')
    .select('*')
    .eq('id', inquiryId)
    .single();

  if (fetchError || !inquiry) {
    return new Response(JSON.stringify({ error: 'Inquiry not found' }), { status: 404 });
  }

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: inquiry.email,
      subject: `Re: Your inquiry to Nebro`,
      html: `<p>Hi ${inquiry.name},</p><p>${message.replace(/\n/g, '<br/>')}</p><p>— The Nebro Team</p>`,
    }),
  });

  if (!emailRes.ok) {
    const errText = await emailRes.text();
    return new Response(JSON.stringify({ error: 'Email send failed: ' + errText }), { status: 502 });
  }

  await callerClient
    .from('inquiries')
    .update({ status: 'responded', responded_at: new Date().toISOString() })
    .eq('id', inquiryId);

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
