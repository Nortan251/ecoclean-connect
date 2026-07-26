const { supabase } = require('./_lib/supabase');
const { verifyUser } = require('./_lib/auth');

// Streak tick endpoint (server-side streak v2). The signed-in client calls this
// on dashboard load + after each civic action so the SERVER is the source of
// truth for the streak (survives devices / logouts). record_daily_activity is
// idempotent per local-calendar-day, so repeated calls within a day are no-ops.
// Returns 401 when not signed in (the client then falls back to its local streak).
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'not signed in' });
  try {
    const { data, error } = await supabase.rpc('record_daily_activity', { uid: user.id });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || { streak_cur: 0, streak_best: 0, changed: false });
  } catch (e) {
    return res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
};
