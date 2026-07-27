const { supabase } = require('./_lib/supabase');
const { verifyUser } = require('./_lib/auth');
const { REPORT_SELECT } = require('./_lib/helpers');

// Returns the signed-in user's profile + server-side points + vouchers + their own
// reports list. Requires a valid access token (401 otherwise). The reports list is
// filtered server-side by the verified user id, so a user only ever sees their own.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'not signed in' });

  // Safety net: ensure a profile exists (the auth trigger normally creates it).
  await supabase
    .from('profiles')
    .upsert({ id: user.id, display_name: (user.user_metadata && user.user_metadata.display_name) || 'Guardian' }, { onConflict: 'id', ignoreDuplicates: true });

  const [{ data: profile }, { data: vouchers }, { count: myReports }, { data: myReportsList }, { data: adminCtx }] = await Promise.all([
    supabase.from('profiles').select('display_name, points, claimed_quests, streak_cur, streak_best').eq('id', user.id).single(),
    supabase.from('vouchers').select('code, points, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('reporter_user_id', user.id),
    supabase.from('reports').select(REPORT_SELECT).eq('reporter_user_id', user.id).order('created_at', { ascending: false }).limit(20),
    // admin v2: include this user's admin scope (super / association city / none) so the
    // admin panel can scope itself without a 13th serverless function (Hobby cap = 12).
    supabase.rpc('admin_context', { uid: user.id }).then((r) => r.data).catch(() => null),
  ]);

  // Map the raw admin_context row to a small, UI-friendly object (or null = not admin).
  let admin = null;
  if (adminCtx) {
    if (adminCtx.is_super) admin = { scope: 'all', role: 'super' };
    else if (adminCtx.role === 'admin' && adminCtx.association_id) admin = { scope: 'city', role: 'admin', association_name: adminCtx.association_name, city: adminCtx.city, lat: adminCtx.lat, lng: adminCtx.lng, radius_km: adminCtx.radius_km };
  }

  return res.status(200).json({
    id: user.id,
    email: user.email,
    displayName: profile ? profile.display_name : 'Guardian',
    points: profile ? profile.points : 0,
    streakCur: profile ? (profile.streak_cur || 0) : 0,
    streakBest: profile ? (profile.streak_best || 0) : 0,
    claimedQuests: profile && Array.isArray(profile.claimed_quests) ? profile.claimed_quests : [],
    vouchers: vouchers || [],
    myReports: myReports || 0,
    myReportsList: myReportsList || [],
    admin: admin,
  });
};
