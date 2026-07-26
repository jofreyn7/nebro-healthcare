// ============================================================
// Supabase Edge Function: invite-user
// Called from admin.js with the CALLER's access token (not the
// service role key — that never leaves the server). This function
// checks the caller is a developer/super_admin, then uses the
// service role to actually create + invite the new account.
// Deploy with: supabase functions deploy invite-user
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !caller) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 });
  }

  const { data: callerProfile } = await callerClient
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single();

  if (!callerProfile || !['developer', 'super_admin'].includes(callerProfile.role)) {
    return new Response(JSON.stringify({ error: 'Not authorized to invite users' }), { status: 403 });
  }

  const { email, full_name, role } = await req.json();
  if (!email || !role) {
    return new Response(JSON.stringify({ error: 'email and role are required' }), { status: 400 });
  }
  if (!['developer', 'super_admin', 'staff'].includes(role)) {
    return new Response(JSON.stringify({ error: 'Invalid role' }), { status: 400 });
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: full_name ?? email },
  });

  if (inviteError) {
    return new Response(JSON.stringify({ error: inviteError.message }), { status: 400 });
  }

  await adminClient.from('profiles').update({ role }).eq('id', invited.user.id);

  return new Response(JSON.stringify({ ok: true, userId: invited.user.id }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
