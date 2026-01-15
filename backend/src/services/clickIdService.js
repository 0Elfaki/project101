const crypto = require('crypto');

class ClickIdService {
  generateClickId(userId, affiliateNetwork) {
    const timestamp = Math.floor(Date.now() / 1000);
    const randomHash = crypto.randomBytes(4).toString('hex').slice(0, 7);
    const clickId = `zatii_${timestamp}_${userId.slice(0, 8)}_${randomHash}`;

    return {
      click_id: clickId,
      generated_at: new Date(),
      valid_for_hours: 72,
      affiliate_network: affiliateNetwork,
    };
  }

  validateClickId(clickId) {
    const parts = clickId.split('_');

    if (parts.length !== 4 || parts[0] !== 'zatii') {
      return { valid: false, reason: 'Invalid format' };
    }

    const timestamp = parseInt(parts[1]);
    const now = Math.floor(Date.now() / 1000);
    const threeDaysInSeconds = 3 * 24 * 60 * 60;

    if (now - timestamp > threeDaysInSeconds) {
      return { valid: false, reason: 'Expired' };
    }

    return { valid: true, generated_at: new Date(timestamp * 1000) };
  }

  generateShortCode(clickId) {
    const hash = crypto.createHash('sha256').update(clickId).digest('hex');
    return hash.slice(0, 10).toUpperCase();
  }
}

module.exports = new ClickIdService();
