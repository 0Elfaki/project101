const express = require('express');
const router = express.Router();
const { supabase } = require('../config');

// GET /api/analytics/summary/:userId
router.get('/summary/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { count: totalClicks, error: e1 } = await supabase
      .from('click_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (e1) return res.status(400).json({ success: false, error: e1.message });

    const since7 = new Date();
    since7.setDate(since7.getDate() - 7);

    const { data: recent, error: e2 } = await supabase
      .from('click_events')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', since7.toISOString())
      .order('created_at', { ascending: true });

    if (e2) return res.status(400).json({ success: false, error: e2.message });

    const dayMap = new Map();
    for (const row of (recent || [])) {
      const key = new Date(row.created_at).toISOString().slice(0, 10);
      dayMap.set(key, (dayMap.get(key) || 0) + 1);
    }
    const clicks_last_7_days = Array.from(dayMap.entries()).map(([date, clicks]) => ({ date, clicks }));

    const since30 = new Date();
    since30.setDate(since30.getDate() - 30);

    const { data: recent30, error: e3 } = await supabase
      .from('click_events')
      .select('smart_link_id')
      .eq('user_id', userId)
      .gte('created_at', since30.toISOString());

    if (e3) return res.status(400).json({ success: false, error: e3.message });

    const cnt = new Map();
    for (const r of (recent30 || [])) {
      cnt.set(r.smart_link_id, (cnt.get(r.smart_link_id) || 0) + 1);
    }

    const topIds = Array.from(cnt.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topLinkIds = topIds.map(x => x[0]);
    let top_links = [];

    if (topLinkIds.length > 0) {
      const { data: linkRows, error: e4 } = await supabase
        .from('smart_links')
        .select('id, short_code, original_url, affiliate_network, title, tags')
        .in('id', topLinkIds);

      if (e4) return res.status(400).json({ success: false, error: e4.message });

      const infoMap = new Map((linkRows || []).map(l => [l.id, l]));
      top_links = topIds.map(([id, clicks]) => ({ ...(infoMap.get(id) || { id }), clicks }));
    }

    return res.json({
      success: true,
      total_clicks: totalClicks || 0,
      clicks_last_7_days,
      top_links
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
