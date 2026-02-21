// Single app server: serves React build + PIN auth + email API. No Vercel needed.
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const express = require('express');
const path = require('path');
const authHandler = require('./api/auth');
const sendEmailHandler = require('./api/send-email');

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';
const buildPath = path.join(__dirname, 'build');

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// API (PIN login + send email) – same app
app.post('/api/auth', (req, res) => authHandler(req, res));
app.post('/api/send-email', (req, res) => sendEmailHandler(req, res));

// In production (or when build exists), serve the React app from this server
if (isProd || require('fs').existsSync(buildPath)) {
  app.use(express.static(buildPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) res.sendFile(path.join(buildPath, 'index.html'));
    else res.status(404).json({ error: 'Not found' });
  });
}

app.listen(PORT, () => {
  console.log(`App running at http://localhost:${PORT}`);
  if (isProd || require('fs').existsSync(buildPath)) console.log('Serving React build + API');
  else console.log('API only (run "npm start" in another terminal for React dev)');
});
