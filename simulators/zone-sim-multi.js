import axios from "axios";
import ZONES from "../frontend/src/data/zones.js";

const API = process.env.SIM_API_BASE || "http://localhost:5000";
const sqr3 = Math.sqrt(3);

// Stable seeded random for each substation
function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const state = new Map();

function realisticTelemetry(zone, s) {
  const key = `${zone.id}::${s.id}`;
  if (!state.has(key)) {
    const seed = hashSeed(key);
    const rnd = mulberry32(seed);
    // baseLoad in kW (2–63 typical for LT)
    const baseLoad = Math.round((2 + rnd() * 61) * 10) / 10; // 2–63 kW
    const pf = 0.92 + rnd() * 0.06; // 0.92–0.98
    const singleV = 230 + (rnd() - 0.5) * 3; // 228.5–231.5
    const threeV = 400 + (rnd() - 0.5) * 6; // 397–403
    state.set(key, {
      baseLoad,
      pf,
      singleV,
      threeV,
      loadKW: baseLoad * (0.85 + rnd() * 0.3)
    });
  }
  const sdata = state.get(key);
  // smooth load variation, more pronounced
  const t = Date.now() / 60000;
  const loadVar = 1 + 0.22 * Math.sin(t + hashSeed(key) % 10) + (Math.random() - 0.5) * 0.08;
  sdata.loadKW = Math.max(1.5, Math.min(70, sdata.loadKW * 0.85 + (sdata.baseLoad * loadVar) * 0.15));
  // voltage drift, more pronounced
  sdata.singleV = Math.max(200, Math.min(255, sdata.singleV * 0.97 + 230 * 0.03 + (Math.random() - 0.5) * 2.5));
  sdata.threeV = Math.max(380, Math.min(420, sdata.threeV * 0.97 + 400 * 0.03 + (Math.random() - 0.5) * 4));
  // currents
  const pf = sdata.pf;
  const P_W = sdata.loadKW * 1000;
  const singleI = Math.round((P_W / (sdata.singleV * pf)) * 10) / 10;
  const threeI = Math.round((P_W / (sqr3 * sdata.threeV * pf)) * 10) / 10;
  // status
  let status = 'ok';
  // Fault: voltage out of 200–255V, load > 65kW, or random forced
  if (sdata.singleV < 205 || sdata.singleV > 250 || sdata.threeV < 385 || sdata.threeV > 415 || sdata.loadKW > 65) {
    status = 'fault';
  } else if (sdata.singleV < 215 || sdata.singleV > 245 || sdata.threeV < 390 || sdata.threeV > 410 || sdata.loadKW > 55) {
    status = 'warning';
  }
  // Force a visible number of faults/warnings (5% faults, 10% warnings)
  const r = Math.random();
  if (r < 0.05) status = 'fault';
  else if (r < 0.15 && status === 'ok') status = 'warning';
  return {
    id: s.id,
    name: s.name,
    coords: s.coords,
    singlePhaseVoltage: Math.round(sdata.singleV * 10) / 10,
    singlePhaseCurrent: singleI,
    threePhaseVoltage: Math.round(sdata.threeV * 10) / 10,
    threePhaseCurrent: threeI,
    load: Math.round(sdata.loadKW * 10) / 10,
    status
  };
}

async function sendTelemetryForZone(zone) {
  const subs = zone.substations.map(s => realisticTelemetry(zone, s));
  const payload = {
    zoneId: zone.id,
    zoneName: zone.name,
    timestamp: new Date().toISOString(),
    substations: subs
  };
  try {
    await axios.post(`${API}/telemetry`, payload, { timeout: 3000 });
    // Post logs for faults and warnings
    for (const s of subs) {
      if (s.status === 'fault' || s.status === 'warning') {
        await axios.post(`${API}/logs`, {
          zone: zone.name,
          zoneId: zone.id,
          substation: s.name,
          ssId: s.id,
          status: s.status,
          message: `${s.status.toUpperCase()} at ${s.name}`,
          time: new Date().toISOString()
        }, { timeout: 2000 });
      }
    }
    console.log(`[sim] sent telemetry and logs for ${zone.id}`);
  } catch (err) {
    console.error('[sim] send failed', err.message || err);
  }
}

async function tick() {
  for (const z of ZONES) {
    await sendTelemetryForZone(z);
  }
}

console.log('[sim] starting multi-zone simulator, posting every 5s to', API);
tick();
setInterval(tick, 5000);
