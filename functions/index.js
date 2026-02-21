const { onCall, HttpsError } = require('firebase-functions/v2/https');
const functions = require('firebase-functions');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

function getConfig() {
  const c = functions.config();
  return {
    pinHash: c.pin?.hash || process.env.PIN_HASH,
    jwtSecret: c.jwt?.secret || process.env.JWT_SECRET,
    gmailUser: c.gmail?.user || process.env.GMAIL_USER,
    gmailPassword: c.gmail?.password || process.env.GMAIL_APP_PASSWORD
  };
}

const PIN_LOCKOUT_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const JWT_EXPIRY_SEC = 24 * 60 * 60;

const rateLimitMap = new Map();

function getClientIp(request) {
  const raw = request?.rawRequest;
  if (!raw) return 'unknown';
  const forwarded = raw.headers?.['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return raw.connection?.remoteAddress || raw.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (entry) {
    if (entry.lockoutUntil > now) {
      throw new HttpsError('resource-exhausted', 'Too many failed attempts. Try again later.');
    }
    entry.count += 1;
    if (entry.count >= MAX_ATTEMPTS) {
      entry.lockoutUntil = now + PIN_LOCKOUT_MS;
      rateLimitMap.set(ip, entry);
      throw new HttpsError('resource-exhausted', 'Too many failed attempts. Try again later.');
    }
    rateLimitMap.set(ip, entry);
  } else {
    rateLimitMap.set(ip, { count: 1, lockoutUntil: 0 });
  }
}

function clearRateLimit(ip) {
  rateLimitMap.delete(ip);
}

exports.authWithPin = onCall(async (request) => {
  const pin = request.data?.pin;
  if (typeof pin !== 'string' || !pin.trim()) {
    throw new HttpsError('invalid-argument', 'PIN is required');
  }
  const ip = getClientIp(request);
  checkRateLimit(ip);

  const { pinHash: hash, jwtSecret: secret } = getConfig();
  if (!hash || !secret) {
    throw new HttpsError('failed-precondition', 'Server auth not configured');
  }

  const match = await bcrypt.compare(pin.trim(), hash);
  if (!match) {
    throw new HttpsError('unauthenticated', 'Invalid PIN');
  }
  clearRateLimit(ip);

  const expiresAt = Math.floor(Date.now() / 1000) + JWT_EXPIRY_SEC;
  const token = jwt.sign(
    { sub: 'admin', exp: expiresAt, iat: Math.floor(Date.now() / 1000) },
    secret,
    { algorithm: 'HS256' }
  );
  return { token, expiresAt };
});

function verifyToken(request) {
  const token = request.data?.token || request.data?.sessionToken;
  if (!token) {
    throw new HttpsError('unauthenticated', 'Session required');
  }
  const { jwtSecret: secret } = getConfig();
  if (!secret) {
    throw new HttpsError('failed-precondition', 'Server auth not configured');
  }
  try {
    return jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch (e) {
    throw new HttpsError('unauthenticated', 'Invalid or expired session');
  }
}

exports.sendEmail = onCall(async (request) => {
  verifyToken(request);

  const { to, subject, html } = request.data || {};
  if (!to || typeof to !== 'string' || !to.trim()) {
    throw new HttpsError('invalid-argument', 'Recipient email is required');
  }
  if (!subject || typeof subject !== 'string') {
    throw new HttpsError('invalid-argument', 'Subject is required');
  }
  if (!html || typeof html !== 'string') {
    throw new HttpsError('invalid-argument', 'HTML content is required');
  }

  const { gmailUser: user, gmailPassword: pass } = getConfig();
  if (!user || !pass) {
    throw new HttpsError('failed-precondition', 'Email not configured');
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user, pass }
  });

  await transporter.sendMail({
    from: `"JL Upholstery" <${user}>`,
    to: to.trim(),
    subject,
    html
  });

  return { success: true, message: 'Email sent' };
});
