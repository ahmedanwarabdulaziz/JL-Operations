const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { secret, to, subject, html } = body;

    const apiSecret = process.env.EMAIL_API_SECRET;
    if (!apiSecret || secret !== apiSecret) return res.status(401).json({ error: 'Unauthorized' });

    if (!to || typeof to !== 'string' || !to.trim()) return res.status(400).json({ error: 'Recipient email is required' });
    if (!subject || typeof subject !== 'string') return res.status(400).json({ error: 'Subject is required' });
    if (!html || typeof html !== 'string') return res.status(400).json({ error: 'HTML content is required' });

    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) return res.status(503).json({ error: 'Email not configured on server' });

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

    return res.status(200).json({ success: true, message: 'Email sent' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Server error' });
  }
};
