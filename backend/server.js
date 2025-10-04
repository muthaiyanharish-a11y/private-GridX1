import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

// store telemetry in memory
let telemetryData = {};
// per-zone auto-protect settings and state (persisted to disk)
let autoProtect = {}; // { zoneId: { enabled: boolean, isolated: boolean, lastActionAt: ISOString|null } }

// persistent auto-protect file
const AUTO_PROTECT_FILE = path.resolve(process.cwd(), 'autoProtect.json');

const loadAutoProtect = () => {
  try {
    if (fs.existsSync(AUTO_PROTECT_FILE)) {
      const raw = fs.readFileSync(AUTO_PROTECT_FILE, 'utf8');
      const parsed = JSON.parse(raw || '{}');
      if (parsed && typeof parsed === 'object') {
        autoProtect = parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load autoProtect file', e && e.message ? e.message : e);
    autoProtect = {};
  }
};

const persistAutoProtect = () => {
  try {
    fs.writeFileSync(AUTO_PROTECT_FILE, JSON.stringify(autoProtect, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to persist autoProtect', e && e.message ? e.message : e);
  }
};

// load persisted autoProtect on startup
loadAutoProtect();

// API key for control endpoints (protect / simulate). Use env PROTECT_API_KEY or a persisted protect_key.json
const PROTECT_KEY_FILE = path.resolve(process.cwd(), 'protect_key.json');
let PROTECT_API_KEY = process.env.PROTECT_API_KEY || null;

const loadOrCreateProtectKey = () => {
  try {
    if (PROTECT_API_KEY) return;
    if (fs.existsSync(PROTECT_KEY_FILE)) {
      const raw = fs.readFileSync(PROTECT_KEY_FILE, 'utf8');
      const parsed = JSON.parse(raw || '{}');
      if (parsed && parsed.key) {
        PROTECT_API_KEY = parsed.key;
        return;
      }
    }
    // create a random key and persist it for local dev
    const key = crypto.randomBytes(20).toString('hex');
    fs.writeFileSync(PROTECT_KEY_FILE, JSON.stringify({ key }, null, 2), 'utf8');
    PROTECT_API_KEY = key;
    console.log('Protect API key generated and saved to', PROTECT_KEY_FILE);
  } catch (e) {
    console.error('Failed to load/create protect key', e && e.message ? e.message : e);
  }
};

loadOrCreateProtectKey();

// middleware to require API key on sensitive endpoints
const requireApiKey = (req, res, next) => {
  const headerKey = req.headers['x-api-key'] || (req.headers['authorization'] && String(req.headers['authorization']).startsWith('Bearer ') ? String(req.headers['authorization']).slice(7) : null);
  if (!PROTECT_API_KEY) {
    console.warn('PROTECT_API_KEY not configured; rejecting control request');
    return res.status(500).json({ error: 'server misconfigured' });
  }
  if (!headerKey || headerKey !== PROTECT_API_KEY) return res.status(403).json({ error: 'invalid API key' });
  return next();
};

// simple persistent logs storage (file-backed). We keep events for 30 days by default.
const LOG_FILE = path.resolve(process.cwd(), 'logs.json');
let storedLogs = [];
const DAYS_TO_KEEP = 30;

const loadLogs = () => {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const raw = fs.readFileSync(LOG_FILE, 'utf8');
      const parsed = JSON.parse(raw || '[]');
      if (Array.isArray(parsed)) storedLogs = parsed;
    }
  } catch (e) {
    console.error('Failed to load logs file', e && e.message ? e.message : e);
    storedLogs = [];
  }
  trimOldLogs();
};

const persistLogs = () => {
  try {
    fs.writeFileSync(LOG_FILE, JSON.stringify(storedLogs, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to persist logs', e && e.message ? e.message : e);
  }
};

const trimOldLogs = () => {
  const cutoff = Date.now() - DAYS_TO_KEEP * 24 * 60 * 60 * 1000;
  storedLogs = storedLogs.filter(l => new Date(l.time).getTime() >= cutoff);
};

loadLogs();

// receive telemetry from zones
app.post("/telemetry", (req, res) => {
  // Accept either a simple { zoneId, status } or a detailed payload
  const payload = req.body || {};
  const zoneId = payload.zoneId || payload.id;

  if (!zoneId) {
    return res.status(400).json({ error: 'zoneId required' });
  }

  // Build stored object with timestamp
  const entry = {
    receivedAt: new Date(),
    ...payload
  };

  telemetryData[zoneId] = entry;
  // initialize autoProtect state for zone if missing
  if (!autoProtect[zoneId]) {
    autoProtect[zoneId] = { enabled: false, isolated: false, lastActionAt: null };
    // persist newly-initialized zone
    persistAutoProtect();
  }
  // detection logic: if payload indicates a break or a derived signal (e.g., breakDetected:true), trigger auto-isolation
  const breakDetected = !!payload.breakDetected || payload.status === 'broken' || payload.current === 0;
  if (breakDetected && autoProtect[zoneId].enabled && !autoProtect[zoneId].isolated) {
    // mark isolated and write a log entry
    autoProtect[zoneId].isolated = true;
    autoProtect[zoneId].lastActionAt = new Date().toISOString();
    const isolationEntry = {
      zone: zoneId,
      substation: payload.substation || null,
      status: 'fault',
      message: 'Auto-isolation triggered due to line break detection',
      time: new Date().toISOString()
    };
    storedLogs.push(isolationEntry);
    trimOldLogs();
    persistLogs();
    // persist updated protect state
    persistAutoProtect();
    console.log('Auto-isolation performed for zone', zoneId);
  }
  console.log("Telemetry received:", zoneId, Object.keys(payload).length ? 'detailed' : payload.status);
  res.json({ message: "Telemetry stored", zoneId });
});

// get auto-protect settings/state
app.get('/protect', (req, res) => {
  res.json(autoProtect);
});

// set auto-protect for a zone { zoneId, enabled }
app.post('/protect', requireApiKey, (req, res) => {
  const { zoneId, enabled } = req.body || {};
  if (!zoneId) return res.status(400).json({ error: 'zoneId required' });
  autoProtect[zoneId] = autoProtect[zoneId] || { enabled: false, isolated: false, lastActionAt: null };
  autoProtect[zoneId].enabled = !!enabled;
  // if disabling protection, clear isolation state
  if (!enabled) {
    autoProtect[zoneId].isolated = false;
    autoProtect[zoneId].lastActionAt = new Date().toISOString();
  }
  // persist protect change
  persistAutoProtect();
  return res.json({ success: true, zoneId, state: autoProtect[zoneId] });
});

// endpoint to simulate a line break for testing
app.post('/simulate-break', requireApiKey, (req, res) => {
  const { zoneId, substation } = req.body || {};
  if (!zoneId) return res.status(400).json({ error: 'zoneId required' });
  // create a telemetry payload indicating a break
  const payload = { zoneId, substation: substation || null, breakDetected: true, status: 'broken', time: new Date().toISOString() };
  // push telemetry into memory and run same detection logic
  const entry = { receivedAt: new Date(), ...payload };
  telemetryData[zoneId] = entry;
  autoProtect[zoneId] = autoProtect[zoneId] || { enabled: false, isolated: false, lastActionAt: null };
  if (autoProtect[zoneId].enabled && !autoProtect[zoneId].isolated) {
    autoProtect[zoneId].isolated = true;
    autoProtect[zoneId].lastActionAt = new Date().toISOString();
    const isolationEntry = {
      zone: zoneId,
      substation: substation || null,
      status: 'fault',
      message: 'Auto-isolation performed (simulation)',
      time: new Date().toISOString()
    };
    storedLogs.push(isolationEntry);
    trimOldLogs();
    persistLogs();
    // persist updated protect state
    persistAutoProtect();
  }
  return res.json({ success: true, zoneId, state: autoProtect[zoneId] });
});

// store a fault/warning/log event -- frontend (or other services) can post events here
app.post('/logs', (req, res) => {
  const payload = req.body || {};
  const time = payload.time ? new Date(payload.time) : new Date();
  if (!payload.zone) return res.status(400).json({ error: 'zone required' });
  const entry = {
    zone: payload.zone,
    substation: payload.substation || null,
    status: payload.status || 'fault',
    message: payload.message || '',
    time: time.toISOString()
  };
  storedLogs.push(entry);
  trimOldLogs();
  persistLogs();
  return res.json({ success: true, entry });
});

// query logs (optionally filter by start/end ISO strings)
app.get('/logs', (req, res) => {
  const { start, end } = req.query;
  let out = storedLogs.slice();
  if (start) {
    const s = new Date(start).getTime();
    out = out.filter(l => new Date(l.time).getTime() >= s);
  }
  if (end) {
    const e = new Date(end).getTime();
    out = out.filter(l => new Date(l.time).getTime() <= e);
  }
  res.json(out);
});

// summary endpoint: returns days array and per-zone counts for the last N days (default 30)
app.get('/logs/summary', (req, res) => {
  const days = parseInt(req.query.days || '30', 10);
  const now = Date.now();
  const items = [];
  // build days list (ISO date strings)
  const dayList = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    dayList.push(d.toISOString().slice(0, 10));
  }
  // zones set
  const zoneMap = {};
  storedLogs.forEach(l => {
    const d = new Date(l.time).toISOString().slice(0, 10);
    if (!dayList.includes(d)) return;
    zoneMap[l.zone] = zoneMap[l.zone] || { zone: l.zone, counts: {} };
    zoneMap[l.zone].counts[d] = (zoneMap[l.zone].counts[d] || 0) + 1;
  });
  const zones = Object.values(zoneMap).map(z => ({ zone: z.zone, counts: dayList.map(d => z.counts[d] || 0), total: z.counts ? Object.values(z.counts).reduce((a,b)=>a+b,0) : 0 }));
  res.json({ days: dayList, zones });
});

// send telemetry to frontend
app.get("/telemetry", (req, res) => {
  res.json(telemetryData);
});

// receive control commands
app.post("/command", requireApiKey, (req, res) => {
  const { zoneId, action } = req.body;
  console.log(`Command for ${zoneId}: ${action}`);
  res.json({ success: true, zoneId, action });
});

app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});