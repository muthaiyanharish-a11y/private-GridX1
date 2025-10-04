import React, { useEffect, useRef, useState } from "react";
import ZONES from "../data/zones";
import api from "../services/api";
import { Line } from 'react-chartjs-2';
import { lineChartOptions } from '../components/ChartConfig';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import "../styles/glass.css";
import "../styles/responsive.css";

export default function Proof() {
  // simulator state
  const [line1, setLine1] = useState({ curr: 30.0, volt: 220.0, relay: true });
  const [line2, setLine2] = useState({ curr: 28.0, volt: 220.0, relay: true });
  const [logs, setLogs] = useState([]);
  const [simMode, setSimMode] = useState("auto");
  const [simInterval, setSimInterval] = useState(700);
  const [selectedZoneId, setSelectedZoneId] = useState(ZONES && ZONES[0] ? ZONES[0].id : "");
  const [subAId, setSubAId] = useState(() => (ZONES && ZONES[0] && ZONES[0].substations[0] ? ZONES[0].substations[0].id : ""));
  const [subBId, setSubBId] = useState(() => {
    const z = ZONES && ZONES[0];
    return z && z.substations[1] ? z.substations[1].id : (z && z.substations[0] ? z.substations[0].id : "");
  });

  // derived helpers for current zone & substation names
  const currentZone = ZONES.find((z) => z.id === selectedZoneId) || ZONES[0] || null;
  const subAName = currentZone?.substations?.find((s) => s.id === subAId)?.name || "Substation A";
  const subBName = currentZone?.substations?.find((s) => s.id === subBId)?.name || "Substation B";

  // mini-map selection state
  const [mapZone, setMapZone] = useState(currentZone || ZONES[0]);
  const [selectedMarkers, setSelectedMarkers] = useState([]); // array of substation ids (max 2)

  const ssIcon = new L.Icon({
    iconUrl: '/hvac_tower.svg',
    iconSize: [20, 20],
    iconAnchor: [10, 18],
    popupAnchor: [0, -14]
  });

  const FlyTo = ({ position }) => {
    const map = useMap();
    useEffect(() => { if (position) map.flyTo(position, 10, { duration: 0.8 }); }, [position, map]);
    return null;
  };

  // animation / UI keys
  const [wireFlashKey, setWireFlashKey] = useState(0);
  const [relayPulse1Key, setRelayPulse1Key] = useState(0);
  const [relayPulse2Key, setRelayPulse2Key] = useState(0);
  const [sendToBackend, setSendToBackend] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState({ line1: 0, line2: 0 });

  const autoTimerRef = useRef(null);
  // for live charting: keep short history buffers
  const [history1, setHistory1] = useState(() => Array.from({ length: 24 }, (_, i) => ({ t: Date.now() - (23 - i) * 1000, v: 0 })));
  const [history2, setHistory2] = useState(() => Array.from({ length: 24 }, (_, i) => ({ t: Date.now() - (23 - i) * 1000, v: 0 })));

  const log = (text) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [{ time, text }, ...prev].slice(0, 500));
  };

  const formatCurr = (v) => (typeof v === "number" ? v.toFixed(2) : "--");
  const formatVolt = (v) => (typeof v === "number" ? v.toFixed(1) : "--");

  const updateRandomWalk = () => {
    setLine1((prev) => {
      if (!prev.relay) return { ...prev, curr: 0 };
      let curr = prev.curr + (Math.random() - 0.5) * 2.5;
      if (curr < 0) curr = 0.05;
      let volt = prev.volt + (Math.random() - 0.5) * 1.5;
      // push to history
      setHistory1((h) => [...h.slice(-23), { t: Date.now(), v: curr }]);
      return { ...prev, curr, volt };
    });
    setLine2((prev) => {
      if (!prev.relay) return { ...prev, curr: 0 };
      let curr = prev.curr + (Math.random() - 0.5) * 2.5;
      if (curr < 0) curr = 0.05;
      let volt = prev.volt + (Math.random() - 0.5) * 1.5;
      setHistory2((h) => [...h.slice(-23), { t: Date.now(), v: curr }]);
      return { ...prev, curr, volt };
    });
  };

  const startAuto = () => {
    stopAuto();
    const ms = Number(simInterval) || 700;
    autoTimerRef.current = setInterval(() => {
      updateRandomWalk();
      if (Math.random() < 0.02) injectSpike();
    }, ms);
    log("Auto simulation started");
  };

  const stopAuto = () => {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
      log("Auto stopped");
    }
  };

  useEffect(() => {
    if (simMode === "auto") startAuto();
    return () => stopAuto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simMode, simInterval]);

  const maybePostLog = async (entry) => {
    if (!sendToBackend) return;
    try {
      await api.post("/logs", entry);
    } catch (e) {
      log("Failed to post: " + (e?.message || e));
    }
  };

  const resetLines = () => {
    setLine1((p) => ({ ...p, relay: true }));
    setLine2((p) => ({ ...p, relay: true }));
    log("Reset relays to ON");
  };

  const startCooldownTimer = (lineKey) => {
    const key = lineKey === "line1" ? "line1" : "line2";
    const id = setInterval(() => {
      setCooldownRemaining((prev) => {
        const next = Math.max(0, prev[key] - 1);
        if (next === 0) clearInterval(id);
        return { ...prev, [key]: next };
      });
    }, 1000);
  };

  const animateTrip = (line) => {
    setWireFlashKey((k) => k + 1);
    if (line === "line1") {
      setLine1((p) => ({ ...p, relay: false }));
      setRelayPulse1Key((k) => k + 1);
      log("Line 1 TRIPPED (relay opened)");
      maybePostLog({ zone: "POC", substation: "Substation A", status: "fault", time: new Date().toISOString() });
      setCooldownRemaining((p) => ({ ...p, line1: 8 }));
      startCooldownTimer("line1");
    } else {
      setLine2((p) => ({ ...p, relay: false }));
      setRelayPulse2Key((k) => k + 1);
      log("Line 2 TRIPPED (relay opened)");
      maybePostLog({ zone: "POC", substation: "Substation B", status: "fault", time: new Date().toISOString() });
      setCooldownRemaining((p) => ({ ...p, line2: 8 }));
      startCooldownTimer("line2");
    }

    setTimeout(() => {
      if (line === "line1") {
        setLine1((p) => ({ ...p, relay: true }));
        log("Line 1 re-enabled");
        maybePostLog({ zone: "POC", substation: "Substation A", status: "ok", time: new Date().toISOString() });
      } else {
        setLine2((p) => ({ ...p, relay: true }));
        log("Line 2 re-enabled");
        maybePostLog({ zone: "POC", substation: "Substation B", status: "ok", time: new Date().toISOString() });
      }
    }, 8000);
  };

  const injectSpike = () => {
    setLine1((p) => ({ ...p, curr: 120.0, volt: 280.0 }));
    setHistory1((h) => [...h.slice(-23), { t: Date.now(), v: 120.0 }]);
    log(`Injected spike on Line A (${subAId || "unknown"})`);
    animateTrip("line1");
  };

  const simulateFaultOn = (line) => {
    if (line === 1) {
      setLine1((p) => ({ ...p, curr: 200, volt: 290, relay: false }));
      setHistory1((h) => [...h.slice(-23), { t: Date.now(), v: 200 }]);
      animateTrip('line1');
    } else {
      setLine2((p) => ({ ...p, curr: 200, volt: 290, relay: false }));
      setHistory2((h) => [...h.slice(-23), { t: Date.now(), v: 200 }]);
      animateTrip('line2');
    }
  };

  const relayPulse = (which) => {
    if (which === 1) setRelayPulse1Key((k) => k + 1);
    else setRelayPulse2Key((k) => k + 1);
  };

  useEffect(() => {
    if (!relayPulse1Key) return;
    const id = setTimeout(() => setRelayPulse1Key(0), 420);
    return () => clearTimeout(id);
  }, [relayPulse1Key]);
  useEffect(() => {
    if (!relayPulse2Key) return;
    const id = setTimeout(() => setRelayPulse2Key(0), 420);
    return () => clearTimeout(id);
  }, [relayPulse2Key]);
  useEffect(() => {
    if (!wireFlashKey) return;
    const id = setTimeout(() => setWireFlashKey(0), 1200);
    return () => clearTimeout(id);
  }, [wireFlashKey]);

  const relayClass1 = `relay-ind ${line1.relay ? "on" : "off"}`;
  const relayClass2 = `relay-ind ${line2.relay ? "on" : "off"}`;
  const relay1PulseClass = relayPulse1Key ? "pulse" : "";
  const relay2PulseClass = relayPulse2Key ? "pulse" : "";

  return (
    <div className="proof-root glass-background">
      <div className="wrap">
        <header className="glass-header fade-in">
          <h1>LV Line Simulator</h1>
          <div className="muted text-glow">POC simulator — simulated values only</div>
        </header>

        <div className="map-layout glass-grid" style={{ display: 'flex', width: '100%', gap: 12 }}>
          <div style={{ width: 320 }} className="glass-card controls slide-in">
            <div className="row">
              <label className="small">Simulator</label>
              <select value={simMode} onChange={(e) => setSimMode(e.target.value)}>
                <option value="auto">Auto</option>
                <option value="manual">Manual</option>
              </select>
            </div>

            <div className="row">
              <label className="small">Zone</label>
              <select
                value={selectedZoneId}
                onChange={(e) => {
                  const zid = e.target.value;
                  setSelectedZoneId(zid);
                  const zone = ZONES.find((z) => z.id === zid);
                  if (zone && zone.substations) {
                    // default substation picks for the selected zone
                    setSubAId(zone.substations[0]?.id ?? "");
                    setSubBId(zone.substations[1]?.id ?? zone.substations[0]?.id ?? "");
                    setMapZone(zone);
                  }
                }}
              >
                {ZONES.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Substation selectors: let user pick Substation A and B explicitly */}
            <div className="row">
              <label className="small">Substation A</label>
              <select value={subAId} onChange={(e) => setSubAId(e.target.value)}>
                {(currentZone?.substations || []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="row">
              <label className="small">Substation B</label>
              <select value={subBId} onChange={(e) => setSubBId(e.target.value)}>
                {(currentZone?.substations || []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

          </div>

          <div style={{ flex: 1 }} className="glass-card map-central fade-in" >
              {/* Map filling the central area, similar to MapView */}
              <div style={{ height: 520 }}>
                <MapContainer center={mapZone.center} zoom={9} style={{ height: "100%", width: "100%" }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                  {/* Zone circle for the current mapZone */}
                  {mapZone && (
                    <>
                      <Circle center={mapZone.center} radius={mapZone.radiusMeters || 16000} pathOptions={{ color: '#16a34a', opacity: 0.8, weight: 2, fillOpacity: 0.04 }} />
                      {mapZone.substations && mapZone.substations.length > 1 && (
                        <Polyline positions={mapZone.substations.map(s => s.coords)} color={'#0f766e'} weight={3} opacity={0.95} />
                      )}

                      {mapZone.substations.map(s => (
                        <Marker key={s.id} position={s.coords} icon={ssIcon}>
                          <Popup>
                            <div style={{ fontWeight:700 }}>{s.name}</div>
                            <div style={{ fontSize:12, color:'var(--muted)' }}>{mapZone.name}</div>
                            <div style={{ marginTop:8 }}>
                              <button className="ghost" onClick={(ev) => { ev.stopPropagation(); setSubAId(s.id); }}>Assign to A</button>
                              <button className="ghost" onClick={(ev) => { ev.stopPropagation(); setSubBId(s.id); }}>Assign to B</button>
                            </div>
                          </Popup>
                        </Marker>
                      ))}
                    </>
                  )}

                  <FlyTo position={mapZone.center} />
                </MapContainer>
              </div>

              <div style={{ marginTop: 12, display: 'flex', gap: 12, justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <strong>Line 1</strong>
                  <div className="muted">Current: {formatCurr(line1.curr)} A</div>
                </div>
                <div style={{ flex: 1 }}>
                  <strong>Line 2</strong>
                  <div className="muted">Current: {formatCurr(line2.curr)} A</div>
                </div>
              </div>

              {/* live current chart */}
              <div style={{ marginTop: 18 }}>
                <div style={{ height: 160 }}>
                  <Line
                    data={{
                      labels: history1.map(h => new Date(h.t).toLocaleTimeString()),
                      datasets: [
                        { label: subAName, data: history1.map(h => h.v), borderColor: '#0b5cff', backgroundColor: 'rgba(11,92,255,0.08)', tension: 0.2 },
                        { label: subBName, data: history2.map(h => h.v), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.06)', tension: 0.2 }
                      ]
                    }}
                    options={{ ...lineChartOptions, plugins: { ...lineChartOptions.plugins, legend: { position: 'bottom' } } }}
                  />
                </div>
              </div>
            </div>
            {/* Right panel: assignments and logs */}
            <div style={{ width: 360 }} className="glass-card slide-in">
              <div style={{ fontWeight: 700 }}>POC Assignments</div>
              <div style={{ marginTop: 8 }}>
                <div><strong>A:</strong> {subAName} <span className="muted">{line1.relay ? '(relay ON)' : '(relay OFF)'}</span></div>
                <div style={{ marginTop: 6 }}><strong>B:</strong> {subBName} <span className="muted">{line2.relay ? '(relay ON)' : '(relay OFF)'}</span></div>
                <div style={{ marginTop: 12 }}>
                  <button className="glass-button pulse-hover" onClick={() => simulateFaultOn(1)}>Trip A (simulate)</button>
                  <button className="glass-button pulse-hover" onClick={() => simulateFaultOn(2)} style={{ marginLeft: 8 }}>Trip B (simulate)</button>
                </div>
                <div style={{ marginTop: 12 }}>
                  <button className="ghost" onClick={() => { setSubAId(''); setSubBId(''); }}>Clear assignments</button>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid rgba(12,18,24,0.04)', margin: '12px 0' }} />
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Logs</div>
              <div id="logs" className="logs" style={{ maxHeight: 200, overflow: 'auto' }}>
                {logs.map((l, i) => (
                  <div className="log-line slide-in" key={i}>
                    <span className="log-time">{l.time}</span>
                    <span className="log-message">{l.text}</span>
                  </div>
                ))}
              </div>
            </div>
        </div>

        <hr style={{ border: "none", borderTop: "1px solid #eef2f7", margin: "12px 0" }} />
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Logs</div>
        <div id="logs" className="logs" style={{ maxHeight: 200, overflow: "auto" }}>
          {logs.map((l, i) => (
            <div className="log-line" key={i}>
              {l.time} — {l.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
