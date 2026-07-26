// ============================================================
// Supabase Edge Function: inquiry-alerts
// Deploy with: supabase functions deploy inquiry-alerts
// Schedule with a Supabase Cron Trigger (see SETUP.md) to run
// e.g. every hour — it checks preferences itself, so running it
// hourly is safe even for users who only want a daily digest.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM_EMAIL = Deno.env.get('ALERT_FROM_EMAIL') ?? 'alerts@nebro.co.tz';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    console.error('Resend error:', await res.text());
  }
  return res.ok;
}

Deno.serve(async () => {
  const now = new Date();

  // 1. Find admin users who want email alerts, with their preferences.
  const { data: recipients, error: recError } = await supabase
    .from('notification_preferences')
    .select('user_id, email_enabled, new_inquiry_frequency, stale_reminder_days, profiles!inner(email, full_name, role)')
    .eq('email_enabled', true);

  if (recError) {
    console.error(recError);
    return new Response(JSON.stringify({ error: recError.message }), { status: 500 });
  }

  // 2. New inquiries in the last hour (covers an hourly cron run).
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const { data: newInquiries } = await supabase
    .from('inquiries')
    .select('*')
    .eq('status', 'new')
    .gte('created_at', oneHourAgo);

  // 3. Stale inquiries: still "new" and older than each recipient's threshold.
  let sentCount = 0;

  for (const r of recipients ?? []) {
    const profile = (r as any).profiles;
    if (!profile?.email) continue;

    // New-inquiry alert (only for recipients set to "immediately"/"hourly")
    if (newInquiries?.length && r.new_inquiry_frequency !== 'daily') {
      const rows = newInquiries
        .map(i => `<li><b>${i.name}</b> — ${i.facility ?? 'N/A'} — ${i.category ?? 'N/A'}</li>`)
        .join('');
      await sendEmail(
        profile.email,
        `Nebro: ${newInquiries.length} new inquiry(ies)`,
        `<p>Hi ${profile.full_name},</p><p>New inquiries received:</p><ul>${rows}</ul><p>Log in to the admin panel to respond.</p>`
      );
      sentCount++;
    }

    // Stale-inquiry reminder, based on this user's configured threshold.
    const staleCutoff = new Date(now.getTime() - r.stale_reminder_days * 24 * 60 * 60 * 1000).toISOString();
    const { data: stale } = await supabase
      .from('inquiries')
      .select('*')
      .eq('status', 'new')
      .lte('created_at', staleCutoff);

    if (stale?.length) {
      const rows = stale
        .map(i => `<li><b>${i.name}</b> — waiting since ${new Date(i.created_at).toLocaleDateString()}</li>`)
        .join('');
      await sendEmail(
        profile.email,
        `Nebro: ${stale.length} inquiry(ies) awaiting a response`,
        `<p>Hi ${profile.full_name},</p><p>These inquiries have had no response for over ${r.stale_reminder_days} day(s):</p><ul>${rows}</ul>`
      );
      sentCount++;
    }
  }

  return new Response(JSON.stringify({ ok: true, emailsSent: sentCount }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
