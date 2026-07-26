const { supabase } = require('./_lib/supabase');
const { verifyUser } = require('./_lib/auth');

// Mint a reward voucher for the signed-in user. The deduction + mint happen
// atomically inside the mint_voucher() security-definer function (server-side),
// so a client can never forge points or vouchers. Returns the new balance.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'not signed in' });

  const { data: code, error } = await supabase.rpc('mint_voucher', { uid: user.id, cost: 50 });
  if (error) return res.status(500).json({ error: error.message });
  if (!code) return res.status(400).json({ error: 'not enough points' });

  const { data: prof } = await supabase.from('profiles').select('points').eq('id', user.id).single();
  return res.status(200).json({ code: code, points: prof ? prof.points : 0 });
};
