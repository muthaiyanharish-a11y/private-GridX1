import React, { useEffect, useMemo, useState, useRef } from "react";
import { MapContainer, TileLayer, Circle, Marker, Popup, Polyline, Polygon, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/map.css";
import ZONES from "../data/zones";
import ZoneSidebar from "../components/ZoneSidebar";
import api from "../services/api";
import mockData from "../services/mockData";

// Icons
const SS_ICON_URL = "/hvac_tower.svg";
const ssIcon = new L.Icon({
  iconUrl: SS_ICON_URL,
  iconSize: [28, 28],
  iconAnchor: [14, 24],
  popupAnchor: [0, -20],
});


function FlyTo({ position }) {
  const map = useMap();
  useEffect(() => {
    if (!position) return;
    map.flyTo(position, 11, { duration: 1.2 });
  }, [position, map]);
  return null;
}

export default function MapView({ setAlerts, setLogs }) {
  const [zones, setZones] = useState(() => ZONES.map(z => ({ ...z, status: "ok" })));
  const [telemetry, setTelemetry] = useState({});
  const [selectedZone, setSelectedZone] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const subSimRef = useRef({});

  // seeded pseudo-random generator (mulberry32) to create stable simulated values per substation
  const seedFromString = (str) => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
    }
    return h;
  };
  const mulberry32 = (a) => () => {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  const getSimTelemetryFor = (z, s) => {
    const key = `${z.id}::${s.id}`;
    if (subSimRef.current[key]) return subSimRef.current[key];
    const seed = seedFromString(key);
    const rnd = mulberry32(seed);
    // single-phase voltage around 220-230
    const singleV = Math.round(220 + rnd() * 12); // 220-232
    // three-phase approx line-to-line
    const threeV = Math.round(singleV * Math.sqrt(3) + (rnd() - 0.5) * 6);
    // load small feeder 2-50 kW
    const load = Math.round(2 + rnd() * 48);
    const spI = Math.round((load * 1000) / Math.max(1, singleV));
    const tpI = Math.round((load * 1000) / (Math.sqrt(3) * Math.max(1, threeV)));
    const status = rnd() > 0.95 ? 'fault' : rnd() > 0.88 ? 'warning' : 'ok';
    const obj = { singlePhaseVoltage: singleV, threePhaseVoltage: threeV, load, singlePhaseCurrent: spI, threePhaseCurrent: tpI, status };
    subSimRef.current[key] = obj;
    return obj;
  };

  // helper: distance between two lat/lng in meters (haversine)
  const haversineMeters = (a, b) => {
    const toRad = (v) => v * Math.PI / 180;
    const R = 6371000; // meters
    const dLat = toRad(b[0] - a[0]);
    const dLon = toRad(b[1] - a[1]);
    const lat1 = toRad(a[0]);
    const lat2 = toRad(b[0]);
    const sinDlat = Math.sin(dLat/2);
    const sinDlon = Math.sin(dLon/2);
    const aa = sinDlat*sinDlat + sinDlon*sinDlon * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa));
    return R * c;
  };

  // Ensure zone circles cover all substations: derive adjusted zones
  const zonesWithRadius = useMemo(() => {
    return zones.map(z => {
      if (!z.substations || z.substations.length === 0) return z;
      const dists = z.substations.map(s => haversineMeters(z.center, s.coords));
      const maxDist = Math.max(...dists, 0);
      // add 10% padding and ensure at least original radius
      const adjusted = Math.max(z.radiusMeters || 1000, Math.ceil(maxDist * 1.1));
      return { ...z, radiusMeters: adjusted };
    });
  }, [zones]);

  // fetch telemetry from backend; if backend missing, keep static statuses
  useEffect(() => {
    let mounted = true;

    const fetchTelemetry = async () => {
      try {
        const res = await api.get("/telemetry"); // expects an object keyed by zone id
        if (!mounted) return;
        let data = res?.data || {};
        if (!data || Object.keys(data).length === 0) {
          data = mockData.getLiveTelemetry();
        }
        setTelemetry(data);

        // Map telemetry to zones status
        setZones(prev =>
          prev.map(z => {
            const tz = data[z.id];
            // tz is expected { voltage, current, failureProb, status }
            if (!tz) return { ...z, status: z.status || "ok" };
            const newStatus = tz.status || (tz.failureProb > 0.9 ? "fault" : tz.failureProb > 0.7 ? "warning" : "ok");
            if (newStatus !== z.status) {
              // push a log to App if provided
              if (typeof setLogs === "function") {
                setLogs(l => [{ zone: z.name, status: newStatus, time: new Date().toLocaleTimeString() }, ...l].slice(0, 200));
              }
            }
            return { ...z, status: newStatus };
          })
        );

        // update global alerts
        if (setAlerts) {
          const newAlerts = [];
          Object.entries(data).forEach(([zid, v]) => {
            if (v && v.failureProb && v.failureProb > 0.7) {
              const zone = ZONES.find(x => x.id === zid);
              newAlerts.push({ message: `${zone?.name ?? zid} - ${(v.failureProb*100).toFixed(0)}% risk` });
            }
          });
          setAlerts(newAlerts);
        }

        // push a small telemetry summary log on every fetch so Logs tab refreshes
        if (typeof setLogs === 'function') {
          const summary = Object.entries(data).slice(0,5).map(([zid, v]) => {
            const zone = ZONES.find(x => x.id === zid);
            return `${zone?.name ?? zid}: ${v.substations?.length ?? 0} ss, risk ${((v.failureProb||0)*100).toFixed(0)}%`;
          }).join(' | ') || 'Telemetry poll (no data)';
          setLogs(l => [{ time: new Date().toLocaleTimeString(), message: summary }, ...l].slice(0, 500));
        }
      } catch (err) {
        // silently fallback to static ZONES; log to console
        console.warn("MapView: telemetry fetch failed (frontend will use static demo data).", err.message || err);
      }
    };

    // initial fetch + interval
    fetchTelemetry();
    const id = setInterval(fetchTelemetry, 5000);
    return () => { mounted = false; clearInterval(id); };
  }, [setAlerts, setLogs]);

  // (Kerala polygon and point-in-polygon helper removed; not used in current view)

  // handle zone click -> center/fly
  const onSelectZone = (z) => {
    setSelectedZone(z);
  };

  return (
    <div className="page-bg page-map">
      <div className="page-accent"><div style={{ fontWeight:700, color:'var(--primary-color)' }}>Map</div></div>
      <div className="page-shell">
      <div className="map-layout" style={{ display: 'flex', width: '100%', height: '100%' }}>
        {sidebarOpen && <ZoneSidebar zones={zones} selectedId={selectedZone?.id} onSelect={onSelectZone} />}

        <div className="map-area" style={{ flex: 1 }}>
          <div className="map-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ textAlign: 'center', flex: 1 }} className="map-header">
            <div>
              <h3 className="map-title">Grid Map</h3>
              <div className="map-subtitle">Click a zone or marker to inspect</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: 'center' }}>
            <div style={{ padding: 8, background: "white", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              Hub connected to {zones.length} zones
            </div>
            <button
              onClick={() => setSidebarOpen(s => !s)}
              style={{ marginLeft: 8, padding: '8px 10px', borderRadius: 8, border: 'none', background: 'var(--primary-color)', color: 'white', cursor: 'pointer' }}
            >
              {sidebarOpen ? 'Hide zones' : 'Show zones'}
            </button>
          </div>
        </div>

        <div className="map-wrapper" style={{ paddingBottom: 12, minHeight: 0 }}>
          <MapContainer center={[10.3, 76.2]} zoom={7} style={{ height: "100%", width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />


            {/* Kerala polygon and hub removed — keeping map and zone circles only */}

            {/* Zone circles, substation markers, and lightweight inter-substation lines */}
            {zonesWithRadius.map((z) => (
              <React.Fragment key={z.id}>
                <Circle
                  center={z.center}
                  radius={z.radiusMeters}
                  pathOptions={{
                    color: z.status === "fault" ? "#ef4444" : z.status === "warning" ? "#f59e0b" : "#16a34a",
                    opacity: 0.85,
                    dashArray: '6,8',
                    weight: 2,
                    fillColor: "#ffffff",
                    fillOpacity: 0.04
                  }}
                />

                {/* Lightweight but more visible lines connecting each substation in order */}
                {z.substations && z.substations.length > 1 && (
                  <Polyline positions={z.substations.map(s => s.coords)} color={"#0f766e"} weight={2.8} opacity={0.95} smoothFactor={1} />
                )}

                {z.substations?.map((s) => {
                  const subT = telemetry[z.id]?.substations?.find(sub => sub.id === s.id) || {};
                  // prefer explicit single/three-phase fields if provided, otherwise map old names, otherwise simulate
                  const singleV = subT.singlePhaseVoltage ?? subT.spV ?? subT.voltage ?? getSimTelemetryFor(z, s).singlePhaseVoltage;
                  const threeV = subT.threePhaseVoltage ?? subT.tpV ?? getSimTelemetryFor(z, s).threePhaseVoltage;
                  const load = subT.load ?? subT.kW ?? getSimTelemetryFor(z, s).load;
                  const spI = subT.singlePhaseCurrent ?? subT.spCurrent ?? subT.current ?? getSimTelemetryFor(z, s).singlePhaseCurrent;
                  const tpI = subT.threePhaseCurrent ?? subT.tpCurrent ?? getSimTelemetryFor(z, s).threePhaseCurrent;
                  const status = subT.status ?? getSimTelemetryFor(z, s).status ?? 'Unknown';
                  const statusColor = status === 'fault' ? '#ef4444' : status === 'warning' ? '#f59e0b' : '#16a34a';
                  return (
                    <Marker key={s.id} position={s.coords} icon={ssIcon}>
                      <Popup>
                        <div style={{ fontWeight: 800, marginBottom: 6, textAlign: 'center' }}>{s.name}</div>
                        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6, textAlign: 'center' }}>Zone: {z.name}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, textAlign: 'center' }}>
                          <div><div style={{ color:'var(--muted)', fontSize:12 }}>Load</div><div style={{ fontWeight:700 }}>{load ?? '-'} kW</div></div>
                          <div><div style={{ color:'var(--muted)', fontSize:12 }}>Status</div><div style={{ fontWeight:700, color: statusColor }}>{(status||'ok').toUpperCase()}</div></div>
                          <div><div style={{ color:'var(--muted)', fontSize:12 }}>Single-phase V</div><div style={{ fontWeight:700 }}>{singleV ?? '-'} V</div></div>
                          <div><div style={{ color:'var(--muted)', fontSize:12 }}>Single-phase I</div><div style={{ fontWeight:700 }}>{spI ?? '-'} A</div></div>
                          <div><div style={{ color:'var(--muted)', fontSize:12 }}>Three-phase V</div><div style={{ fontWeight:700 }}>{threeV ?? '-'} V</div></div>
                          <div><div style={{ color:'var(--muted)', fontSize:12 }}>Three-phase I</div><div style={{ fontWeight:700 }}>{tpI ?? '-'} A</div></div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </React.Fragment>
            ))}

            {/* Fly to selected zone */}
            {selectedZone && <FlyTo position={selectedZone.center} />}
          </MapContainer>
        </div>
      </div>
      {/* Right panel/logs removed from Map view; logs are lifted to App and shown on /logs */}
      {/* Floating small show button when sidebar is closed */}
      {!sidebarOpen && (
        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 2200 }}>
          <button onClick={() => setSidebarOpen(true)} style={{ padding: '8px 10px', borderRadius: 8, border: 'none', background: 'var(--surface-1)', color: 'var(--muted)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer' }}>Show zones</button>
        </div>
      )}
      </div>
      </div>
    </div>
  );
}
