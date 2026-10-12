/* global process */
// Cron de Vercel (ver vercel.json): consulta la base una vez al día para que
// el plan gratuito de Supabase no pause el proyecto por inactividad.
export default async function handler(req, res) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return res.status(500).json({ ok: false, error: 'Faltan variables de Supabase' });
  try {
    const r = await fetch(`${url}/rest/v1/config?select=key&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status, at: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ ok: false, error: e.message });
  }
}
