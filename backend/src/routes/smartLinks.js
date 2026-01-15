const express = require('express');
const router = express.Router();
const { supabase } = require('../config');
const crypto = require('crypto');

// Generate short code
function generateShortCode() {
  return crypto.randomBytes(5).toString('hex').toUpperCase();
}

// Generate click ID
function generateClickId(userId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const userIdShort = userId.split('-')[0];
  const random = crypto.randomBytes(3).toString('hex');
  return `zatii_${timestamp}_${userIdShort}_${random}`;
}

// Helpers (analytics logging)
function getReferrerHost(req) {
  try {
    const ref = req.get('referer') || req.get('referrer');
    if (!ref) return null;
    return new URL(ref).hostname.replace('www.', '');
  } catch {
    return null;
  }
}

function getDeviceType(userAgent = '') {
  const ua = String(userAgent).toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) return 'mobile';
  if (ua.includes('ipad') || ua.includes('tablet')) return 'tablet';
  return 'desktop';
}

/**
 * =========================
 * SMART LINKS
 * =========================
 */

// Create smart link
router.post('/create', async (req, res) => {
  try {
    const { user_id, original_url, affiliate_network } = req.body;

    if (!user_id || !original_url || !affiliate_network) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['user_id', 'original_url', 'affiliate_network']
      });
    }

    const clickId = generateClickId(user_id);
    const shortCode = generateShortCode();
    const shortUrl = `${process.env.DOMAIN}/r/${shortCode}`;

    const { data, error } = await supabase
      .from('smart_links')
      .insert([{
        user_id,
        click_id: clickId,
        original_url,
        short_code: shortCode,
        affiliate_network,
        is_active: true
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create smart link',
        message: error.message
      });
    }

    return res.json({
      success: true,
      smart_link: {
        ...data,
        short_url: shortUrl
      }
    });
  } catch (error) {
    console.error('Error creating smart link:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create smart link',
      message: error.message
    });
  }
});

// Get all smart links for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data, error } = await supabase
      .from('smart_links')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    const linksWithUrls = (data || []).map(link => ({
      ...link,
      short_url: `${process.env.DOMAIN}/r/${link.short_code}`
    }));

    return res.json({ success: true, links: linksWithUrls });
  } catch (error) {
    console.error('Error fetching links:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * =========================
 * TAGS / META
 * Requires DB columns:
 * - smart_links.title text
 * - smart_links.tags text[] default '{}'
 * =========================
 */

router.patch('/:id/meta', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, tags } = req.body;

    const payload = {};

    if (typeof title === 'string') {
      payload.title = title.trim().slice(0, 120);
    }

    if (Array.isArray(tags)) {
      const cleanTags = Array.from(
        new Set(tags.map(t => String(t).trim()).filter(Boolean))
      ).slice(0, 20);
      payload.tags = cleanTags;
    }

    const { data, error } = await supabase
      .from('smart_links')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true, link: data });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/:id/tags', async (req, res) => {
  try {
    const { id } = req.params;
    const tag = String(req.body.tag || '').trim();
    if (!tag) return res.status(400).json({ success: false, error: 'tag required' });

    const { data: current, error: e1 } = await supabase
      .from('smart_links')
      .select('tags')
      .eq('id', id)
      .single();

    if (e1) return res.status(400).json({ success: false, error: e1.message });

    const tags = Array.isArray(current.tags) ? current.tags : [];
    const newTags = Array.from(new Set([...tags, tag])).slice(0, 20);

    const { data, error } = await supabase
      .from('smart_links')
      .update({ tags: newTags })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true, link: data });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/:id/tags/:tag', async (req, res) => {
  try {
    const { id, tag } = req.params;

    const { data: current, error: e1 } = await supabase
      .from('smart_links')
      .select('tags')
      .eq('id', id)
      .single();

    if (e1) return res.status(400).json({ success: false, error: e1.message });

    const tags = Array.isArray(current.tags) ? current.tags : [];
    const newTags = tags.filter(t => t !== tag);

    const { data, error } = await supabase
      .from('smart_links')
      .update({ tags: newTags })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true, link: data });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * =========================
 * REDIRECT (mounted on /r)
 * =========================
 * Logs click_events (ip=no) then redirects.
 */
router.get('/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;

    const { data: link, error } = await supabase
      .from('smart_links')
      .select('id,user_id,click_id,short_code,original_url,is_active')
      .eq('short_code', shortCode)
      .single();

    if (error || !link) return res.status(404).send('Link not found');
    if (link.is_active === false) return res.status(410).send('Link is inactive');

    const referrerHost = getReferrerHost(req);
    const userAgent = req.get('user-agent') || '';
    const deviceType = getDeviceType(userAgent);

    // Do not block redirect if logging fails
    supabase
      .from('click_events')
      .insert([{
        smart_link_id: link.id,
        user_id: link.user_id,
        click_id: link.click_id,
        short_code: link.short_code,
        referrer_host: referrerHost,
        user_agent: userAgent.slice(0, 500),
        device_type: deviceType
      }])
      .then(() => {})
      .catch(() => {});

    return res.redirect(link.original_url);
  } catch (error) {
    console.error('Redirect error:', error);
    return res.status(500).send('Error processing redirect');
  }
});

module.exports = router;
