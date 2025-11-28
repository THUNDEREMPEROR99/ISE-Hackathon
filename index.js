require('dotenv').config();
const express = require('express');
const path = require('path');

// Use global fetch if available (Node 18+). Otherwise dynamically import node-fetch
let fetchFn = globalThis.fetch;
if (!fetchFn) {
  try {
    // dynamic import returns a promise; wrap into a function that behaves like fetch
    fetchFn = (...args) => import('node-fetch').then(mod => mod.default(...args));
  } catch (e) {
    // leave fetchFn undefined — later code will error with a clear message
    fetchFn = undefined;
  }
}

const app = express();
app.use(express.json());

const HF_KEY = process.env.HF_API_KEY || process.env.VITE_HF_API_KEY || null;
const HF_MODEL = process.env.HF_MODEL || process.env.VITE_HF_MODEL || 'gpt2';
const LOCAL_AI_URL = process.env.LOCAL_AI_URL || 'http://127.0.0.1:5001';

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, hf_key: !!HF_KEY, local_ai: LOCAL_AI_URL });
});

// Proxy OpenFoodFacts (no key required)
app.get('/api/openfoodfacts/:barcode', async (req, res) => {
  const barcode = req.params.barcode;
  try {
    if (!fetchFn) throw new Error('fetch is not available in this Node runtime');
    const offUrl = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;
    const r = await fetchFn(offUrl);
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'openfoodfacts proxy error' });
  }
});

// AI proxy: prefer local model server if reachable, else use Hugging Face if HF_KEY configured
app.post('/api/ai', async (req, res) => {
  const payload = req.body;

  // Try local model server first
  try {
    if (fetchFn) {
      const localUrl = `${LOCAL_AI_URL.replace(/\/$/, '')}/api/generate`;
      const localResp = await fetchFn(localUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (localResp && localResp.ok) {
        const data = await localResp.json();
        return res.status(200).json({ source: 'local', data });
      }
    }
  } catch (e) {
    // ignore and fallback to HF
  }

  if (!HF_KEY) {
    return res.status(503).json({ error: 'No local model available and HF_API_KEY not configured on server.' });
  }

  try {
    const url = `https://api-inference.huggingface.co/models/${HF_MODEL}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json();
    return res.status(r.status).json({ source: 'hf', data });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'hf proxy error' });
  }
});

// Serve a minimal static health page (optional)
app.use('/proxy-static', express.static(path.join(__dirname, 'static')));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`AI proxy listening on http://localhost:${PORT}`));
