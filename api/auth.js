const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const PIN_LOCKOUT_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const JWT_EXPIRY_SEC = 24 * 60 * 60;
const rateLimitMap = new Map();

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (entry) {
    if (entry.lockoutUntil > now) throw new Error('Too many failed attempts. Try again later.');
    entry.count += 1;
    if (entry.count >= MAX_ATTEMPTS) {
      entry.lockoutUntil = now + PIN_LOCKOUT_MS;
      rateLimitMap.set(ip, entry);
      throw new Error('Too many failed attempts. Try again later.');
    }
    rateLimitMap.set(ip, entry);
  } else {
    rateLimitMap.set(ip, { count: 1, lockoutUntil: 0 });
  }
}

function clearRateLimit(ip) {
  rateLimitMap.delete(ip);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const pin = body.pin;
    if (typeof pin !== 'string' || !pin.trim()) {
      return res.status(400).json({ error: 'PIN is required' });
    }

    const ip = getClientIp(req);
    checkRateLimit(ip);

    const hash = process.env.PIN_HASH;
    const secret = process.env.JWT_SECRET;
    if (!hash || !secret) return res.status(503).json({ error: 'Server auth not configured' });

    const match = await bcrypt.compare(pin.trim(), hash);
    if (!match) return res.status(401).json({ error: 'Invalid PIN' });
    clearRateLimit(ip);

    const expiresAt = Math.floor(Date.now() / 1000) + JWT_EXPIRY_SEC;
    const token = jwt.sign(
      { sub: 'admin', exp: expiresAt, iat: Math.floor(Date.now() / 1000) },
      secret,
      { algorithm: 'HS256' }
    );
    return res.status(200).json({ token, expiresAt });
  } catch (e) {
    if (e.message && e.message.includes('Too many')) return res.status(429).json({ error: e.message });
    return res.status(500).json({ error: e.message || 'Server error' });
  }
};
