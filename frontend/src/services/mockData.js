// Simple deterministic-ish mock data generator for demo mode
import ZONES from '../data/zones';

// seeded random (mulberry32)
function seedFrom(n){ return function(){ let t = n += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Core generators (unchanged logic) kept private
function _generateLogs(days = 30, count = 200, seed = 12345){
  const now = Date.now();
  const rnd = seedFrom(seed);
  const logs = [];
  const zoneList = ZONES;
  for(let i=0;i<count;i++){
    const ago = Math.floor(rnd()*days*24*60*60*1000);
    const t = new Date(now - ago).toISOString();
    const z = zoneList[Math.floor(rnd()*zoneList.length)];
    const ss = z.substations[Math.floor(rnd()*z.substations.length)];
    const p = rnd();
    const status = p > 0.95 ? 'fault' : (p > 0.82 ? 'warning' : 'ok');
    const message = status === 'fault' ? 'Short-circuit detected, auto-isolation' : status === 'warning' ? 'Overload / high current' : 'Normal event';
    const resolved = rnd() > 0.4;
    const resolution_time = resolved ? Math.round(30 + rnd()*240) : null;
    logs.push({ time: t, zone: z.name, zoneId: z.id, zoneName: z.name, substation: ss.name, ssId: ss.id, ssName: ss.name, status, message, resolution_time });
  }
  logs.sort((a,b)=> (b.time||'').localeCompare(a.time||''));
  return logs;
}

function _generateTelemetry(seed = 6789){
  const rnd = seedFrom(seed);
  const out = {};
  ZONES.forEach(z => {
    const subs = z.substations.map(s => {
      const singlePhaseVoltage = Math.round(220 + (rnd()-0.5)*16);
      const threePhaseVoltage = Math.round(singlePhaseVoltage*Math.sqrt(3)+(rnd()-0.5)*10);
      const load = Math.round(2 + rnd()*98);
      const spI = Math.round((load*1000)/Math.max(1,singlePhaseVoltage));
      const failureProb = Math.min(1, Math.max(0, rnd()*0.4 + (rnd() > 0.85 ? 0.5 : 0)));
      const status = failureProb > 0.5 ? 'fault' : failureProb > 0.25 ? 'warning' : 'ok';
      return { id: s.id, name: s.name, singlePhaseVoltage, threePhaseVoltage, load, singlePhaseCurrent: spI, status, failureProb };
    });
    out[z.id] = { zoneName: z.name, substations: subs, failureProb: 0.05 };
  });
  return out;
}

// Cached datasets (created once per app start) so "1 month of data" stays consistent across pages
const cachedLogs30 = _generateLogs(30, 200, 12345);
const cachedLogs60_800 = _generateLogs(60, 800, 424242);

// Telemetry state which will be mutated slightly on each snapshot to emulate live updates
let telemetryState = _generateTelemetry(6789);
let liveTick = 0;

// Helper: deterministic-ish update using a seeded sequence so snapshots feel stable but change
function updateTelemetryOnce(){
  liveTick++;
  const tickRnd = seedFrom(9000 + liveTick);
  Object.keys(telemetryState).forEach(zid => {
    const z = telemetryState[zid];
    z.substations.forEach(s => {
      // small +/- variation on load (±5%)
      const variation = (tickRnd() - 0.5) * 0.1;
      const newLoad = Math.max(0, Math.round(s.load * (1 + variation)));
      s.load = newLoad;
      // recompute current roughly
      s.singlePhaseCurrent = Math.round((s.load * 1000) / Math.max(1, s.singlePhaseVoltage));
      s.threePhaseCurrent = Math.round((s.load * 1000) / (Math.sqrt(3) * Math.max(1, s.threePhaseVoltage)));
      // nudge failure prob slightly
      const fpDelta = (tickRnd() - 0.5) * 0.02;
      s.failureProb = Math.min(1, Math.max(0, (s.failureProb || 0) + fpDelta));
      // derive status from failureProb and load
      if (s.failureProb > 0.6 || s.load > 140) s.status = 'fault';
      else if (s.failureProb > 0.35 || s.load > 80) s.status = 'warning';
      else s.status = 'ok';
    });
    // zone-level failureProb average
    const avg = z.substations.reduce((acc, x) => acc + (x.failureProb || 0), 0) / Math.max(1, z.substations.length);
    z.failureProb = Math.min(1, Math.max(0, avg));
  });
}

// Public API
export function getCachedLogs(days = 30, count = 200){
  // return the closest cached dataset for stability
  if (days >= 60 || count >= 800) return cachedLogs60_800;
  return cachedLogs30;
}

export function getMockLogs(days = 30, count = 200){
  // fallback/generator kept for compatibility
  return _generateLogs(days, count, 12345 + (count || 0));
}

export function getMockTelemetry(){
  // return a deep-ish copy of the base telemetry state without mutating
  return JSON.parse(JSON.stringify(telemetryState));
}

export function getLiveTelemetry(){
  // mutate internal state a little to emulate live changes, then return a cloned snapshot
  updateTelemetryOnce();
  return JSON.parse(JSON.stringify(telemetryState));
}

export default { getCachedLogs, getMockLogs, getMockTelemetry, getLiveTelemetry };
