const { supabase } = require('./_lib/supabase');
const { verifyUser } = require('./_lib/auth');
const { readJson } = require('./_lib/helpers');

// Server-side quest definitions (mirror the client). A quest is a COOPERATIVE
// milestone (community report + verify counts) so a lone actor can't farm it —
// the verify side needs real admin-confirmed clean-ups. Claiming is validated and
// recorded here, then awards tamper-proof server points exactly once.
const QUESTS = {
  q1: { repNeed: 3, repCat: 'plastic_marine', verNeed: 2, verCat: null, points: 50 },
  q2: { repNeed: 2, repCat: 'water', verNeed: 2, verCat: 'water', points: 40 },
  q3: { repNeed: 2, repCat: null, verNeed: 3, verCat: null, points: 60 },
};
const INF = { count: Infinity };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'not signed in' });

  let body; try { body = await readJson(req); } catch (e) { return res.status(400).json({ error: 'invalid json' }); }
  const q = QUESTS[body && body.questId];
  if (!q) return res.status(400).json({ error: 'unknown quest' });

  const [repAll, repCat, verAll, verCat] = await Promise.all([
    supabase.from('reports').select('id', { count: 'exact', head: true }),
    q.repCat ? supabase.from('reports').select('id', { count: 'exact', head: true }).eq('category', q.repCat) : INF,
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'verified'),
    q.verCat ? supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'verified').eq('category', q.verCat) : INF,
  ]);
  const repOk = (q.repCat ? repCat.count : repAll.count) >= q.repNeed;
  const verOk = (q.verCat ? verCat.count : verAll.count) >= q.verNeed;
  if (!repOk || !verOk) return res.status(400).json({ error: 'quest not complete' });

  const { data: prof, error: pe } = await supabase.from('profiles').select('claimed_quests, points').eq('id', user.id).single();
  if (pe) return res.status(500).json({ error: pe.message });
  const claimed = Array.isArray(prof.claimed_quests) ? prof.claimed_quests : [];
  if (claimed.indexOf(body.questId) >= 0) return res.status(400).json({ error: 'already claimed' });

  await supabase.rpc('award_points', { uid: user.id, amt: q.points });
  await supabase.from('profiles').update({ claimed_quests: [...claimed, body.questId] }).eq('id', user.id);
  return res.status(200).json({ ok: true, points: q.points });
};
