import React, { useEffect, useState, useRef, useMemo } from "react";
import { Card, Table, Button, Tooltip, Space } from "antd";
import "../styles/glass.css";
import "../styles/responsive.css";
import { Line } from 'react-chartjs-2';
import { lineChartOptions } from '../components/ChartConfig';
import api from "../services/api";
import ZONES from "../data/zones";
import PageToolbar from "../components/PageToolbar";

// Inline SVG icons kept in PageToolbar; this file focuses on data and layout

export default function RawData() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [detailHistory, setDetailHistory] = useState([]);
  const [autoInject, setAutoInject] = useState(false);
  const [autoFreq, setAutoFreq] = useState(8000);
  const mounted = useRef(true);
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const columns = [
    {
      title: 'Zone',
      dataIndex: 'zone',
      key: 'zone',
      sorter: (a, b) => a.zone.localeCompare(b.zone)
    },
    {
      title: 'Substation',
      dataIndex: 'substation',
      key: 'substation',
      sorter: (a, b) => a.substation.localeCompare(b.substation)
    },
    {
      title: 'Load (kW)',
      dataIndex: 'load',
      key: 'load',
      sorter: (a, b) => (a.load || 0) - (b.load || 0),
      render: val => val ? val.toFixed(1) : '-'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tooltip title={`Status: ${status.toUpperCase()}`}>
          <span className={`status-badge ${status} fade-in`}>
            {status.toUpperCase()}
          </span>
        </Tooltip>
        </span>
      )
    }
  ];

  // Convert rows to CSV with the desired columns (single & three phase V and I)
  const headers = [
    "Zone",
    "Substation",
    "Load (kW)",
    "Single-phase V (V)",
    "Single-phase I (A)",
    "Three-phase V (V)",
    "Three-phase I (A)",
    "Status"
  ];
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('\n') || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  const rowsToCSV = (rowsArr) => {
    const lines = [headers.join(',')];
    (rowsArr || []).forEach(r => {
      lines.push([
        r.zone,
        r.substation,
        r.load ?? '',
        r.singlePhaseVoltage ?? '',
        r.singlePhaseCurrent ?? '',
        r.threePhaseVoltage ?? '',
        r.threePhaseCurrent ?? '',
        r.status ?? ''
      ].map(esc).join(','));
    });
    return lines.join('\n');
  };

  // Utility: create a small synthetic history for a substation for detail view
  const makeHistoryFor = (baseValue) => {
    const now = Date.now();
    const arr = Array.from({ length: 24 }, (_, i) => {
      const t = now - (23 - i) * 1000;
      const jitter = (Math.random() - 0.5) * 0.2 * baseValue;
      return { t, v: Math.max(0, Math.round((baseValue + jitter) * 100) / 100) };
    });
    return arr;
  };

  /* removed a small table-return here; the main rich UI below will render instead */

  const downloadCSV = (filename, csv) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const saveToLocal = (key, csv) => {
    try { localStorage.setItem(key, csv); return true; } catch { return false; }
  };

  const printRows = (rowsToPrint) => {
    const table = `
      <html><head><title>Raw Telemetry</title>
      <style>body{font-family:Inter,system-ui,Arial;color:var(--text);}table{width:100%;border-collapse:collapse;}th,td{padding:8px;border:1px solid #eee;text-align:left}</style>
      </head><body><h2>Raw Telemetry Data</h2><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${(rowsToPrint||[]).map(r=>`<tr><td>${r.zone}</td><td>${r.substation}</td><td>${r.voltage ?? ''}</td><td>${r.load ?? ''}</td><td>${r.singlePhaseCurrent ?? ''}</td><td>${r.threePhaseCurrent ?? ''}</td><td>${r.status ?? ''}</td></tr>`).join('')}</tbody></table></body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(table);
    w.document.close();
    w.focus();
    w.print();
  };

  const emailRows = (rowsToEmail) => {
    const subject = encodeURIComponent('Raw telemetry export');
    const summary = encodeURIComponent(`Attached is a CSV export of ${rowsToEmail.length} telemetry rows. Please download the CSV from the app and attach it to your email.`);
    // mailto cannot attach files; instruct user instead
    window.location.href = `mailto:?subject=${subject}&body=${summary}`;
  };

  // Simulation / fetch logic
  const simulateFromZones = () => {
    const produced = [];
    ZONES.forEach(z => {
      z.substations.forEach(s => {
        // realistic simulation parameters
        // single-phase voltage around 220-240V (tighter tolerance)
        const singlePhaseVoltage = Math.round(225 + (Math.random() - 0.5) * 10); // ~220-230
        // three-phase line-to-line nominal around 400-415V; derive from single-phase * sqrt(3) with small noise
        const threePhaseVoltage = Math.round(singlePhaseVoltage * Math.sqrt(3) + (Math.random() - 0.5) * 8);
        // reasonable substation load in kW (small town feeder) around 2-50 kW
        const load = Math.round(2 + Math.random() * 48); // 2-50 kW
        // currents (single-phase): I = P*1000 / V
        const singlePhaseCurrent = Math.round((load * 1000) / Math.max(1, singlePhaseVoltage));
        // three-phase line current: I = P*1000 / (sqrt(3) * V_ll)
        const threePhaseCurrent = Math.round((load * 1000) / (Math.sqrt(3) * Math.max(1, threePhaseVoltage)));

        // failure probability - 0..1 so thresholds make sense
        const failureProb = Math.random();

        // status rules: fault > warning > ok
        // Adjust load thresholds to the simulated range (2-50 kW)
        let status = 'ok';
        if (singlePhaseVoltage < 200 || singlePhaseVoltage > 250 || failureProb > 0.98) status = 'fault';
        else if (singlePhaseVoltage < 215 || singlePhaseVoltage > 245 || load > 40 || failureProb > 0.9) status = 'warning';

        produced.push({ zone: z.name, substation: s.name, load, singlePhaseVoltage, singlePhaseCurrent, threePhaseVoltage, threePhaseCurrent, status, failureProb });
      });
    });
    return produced;
  };

  const fetchTelemetry = async () => {
    try {
      const res = await api.get('/telemetry');
      let data = res?.data || {};
      const list = [];
      // If backend returned nothing, prefer a live snapshot from the mock generator
      if (!data || Object.keys(data).length === 0) {
        data = mockData.getLiveTelemetry();
      }
      Object.entries(data).forEach(([zoneId, z]) => {
        const zoneName = z.zoneName || zoneId;
        (z.substations || []).forEach(s => {
          // backend may provide different shapes; normalize
          const voltage = s.voltage ?? s.v ?? null;
          const load = s.load ?? s.kW ?? null;
          const singlePhaseCurrent = s.singlePhaseCurrent ?? s.spCurrent ?? null;
          const threePhaseCurrent = s.threePhaseCurrent ?? s.tpCurrent ?? null;
          const status = s.status ?? 'ok';
          list.push({ zone: zoneName, substation: s.name || s.id, voltage, load, singlePhaseCurrent, threePhaseCurrent, status });
        });
      });

      // if backend returned nothing useful, fallback to simulated values
      if (list.length === 0) {
        const sim = simulateFromZones();
        if (!mounted.current) return;
        setRows(sim);
        reportFaults(sim);
      } else {
        // if backend provided rows but all statuses are 'ok', add small randomness so UI shows warnings/faults
        const statusCounts = list.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
        if ((statusCounts.ok || 0) / Math.max(1, list.length) > 0.95) {
          // flip a few random rows to warning/fault
          for (let i = 0; i < Math.max(1, Math.floor(list.length * 0.03)); i++) {
            const idx = Math.floor(Math.random() * list.length);
            if (Math.random() > 0.8) list[idx].status = 'fault';
            else list[idx].status = 'warning';
          }
        }
        if (!mounted.current) return;
        setRows(list);
        // report faults from backend-provided list
        reportFaults(list);
      }
      setLastUpdated(new Date());
      setLoading(false);
    } catch (err) {
      // fallback to simulation
      console.error('RawData: fetch failed', err && err.message ? err.message : err);
      if (!mounted.current) return;
      setRows(simulateFromZones());
      setLoading(false);
    }
  };

  // track last known status per zone+substation to only report changes
  const lastStatusRef = useRef({});
  const reportFaults = async (rowsArr) => {
    if (!Array.isArray(rowsArr)) return;
    try {
      for (const r of rowsArr) {
        const key = `${r.zone}::${r.substation}`;
        const prev = lastStatusRef.current[key];
        if (prev === r.status) continue; // no change
        lastStatusRef.current[key] = r.status;
        // only POST when status is fault or warning
        if (r.status === 'fault' || r.status === 'warning') {
          await api.post('/logs', {
            zone: r.zone,
            substation: r.substation,
            status: r.status,
            message: `Status ${r.status} at ${r.substation}`,
            time: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      // ignore network errors
      void e;
    }
  };

  useEffect(() => {
    mounted.current = true;
    // initial fetch + 5s polling
    fetchTelemetry();
    const id = setInterval(fetchTelemetry, 5000);
    // auto-inject interval
    let injId = null;
    if (autoInject) injId = setInterval(() => {
      setRows(prev => {
        if (!prev || !prev.length) return prev;
        const next = prev.map(r => {
          if (Math.random() > 0.86) return { ...r, status: 'fault' };
          if (Math.random() > 0.8) return { ...r, status: 'warning' };
          return r;
        });
        reportFaults(next);
        return next;
      });
    }, autoFreq);
    return () => { mounted.current = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // watch autoInject toggles
  useEffect(() => {
    let id = null;
    if (autoInject) {
      id = setInterval(() => {
        setRows(prev => {
          if (!prev || !prev.length) return prev;
          const next = prev.map(r => {
            if (Math.random() > 0.86) return { ...r, status: 'fault' };
            if (Math.random() > 0.8) return { ...r, status: 'warning' };
            return r;
          });
          reportFaults(next);
          return next;
        });
      }, Math.max(2000, autoFreq));
    }
    return () => { if (id) clearInterval(id); };
  }, [autoInject, autoFreq]);

  const filteredRows = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    return (rows || []).filter(r => {
      if (zoneFilter !== 'all' && r.zone !== zoneFilter) return false;
      if (statusFilter !== 'all' && String(r.status || '').toLowerCase() !== statusFilter) return false;
      if (!q) return true;
      return (String(r.substation || '').toLowerCase().includes(q) || String(r.zone || '').toLowerCase().includes(q));
    });
  }, [rows, zoneFilter, statusFilter, search]);

  return (
    <div className="page-bg page-raw">
      <div className="page-accent" aria-hidden /><div className="page-shell">
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24, height: 'calc(100vh - 100px)' }}>
      <div className="raw-container" style={{ width: '100%', maxWidth: 1100, margin: '0 auto', background: 'var(--surface)', borderRadius: 18, boxShadow: 'var(--shadow-2)', padding: 18, border: '1px solid rgba(12,18,24,0.04)', maxHeight: 'calc(100vh - 220px)', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ color: 'var(--muted)', fontWeight:700 }}>Live simulated data from all substations. Refreshes every 5 seconds.</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{loading ? 'Loading…' : `Updated: ${lastUpdated?.toLocaleTimeString()}`}</div>
            <div style={{ marginTop: 8 }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 10, background: '#0b5e2c', marginRight: 8 }}></span>
              <small style={{ color: 'var(--muted)' }}>Live</small>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select id="zoneFilter" onChange={(e)=>{ const v=e.target.value; setRows(prev=>prev); setZoneFilter(v); }} value={zoneFilter} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <option value="all">All Zones</option>
              {ZONES.map(z => <option key={z.id} value={z.name}>{z.name}</option>)}
            </select>
            <select id="statusFilter" onChange={(e)=>setStatusFilter(e.target.value)} value={statusFilter} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <option value="all">All Status</option>
              <option value="ok">OK</option>
              <option value="warning">Warning</option>
              <option value="fault">Fault</option>
            </select>
            <input placeholder="Search substation" value={search} onChange={(e)=>setSearch(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }} />
          </div>
          <div style={{ color: 'var(--muted)' }}>{rows.length} rows • Updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}</div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <table className="table raw-table" style={{ width: '100%', minWidth: 720, borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                <th>Zone</th>
                <th>Substation</th>
                <th>Load (kW)</th>
                <th>Single-phase V (V)</th>
                <th>Single-phase I (A)</th>
                <th>Three-phase V (V)</th>
                <th>Three-phase I (A)</th>
                <th>Status</th>
                <th style={{ minWidth: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r, i) => (
                <tr key={i} className={i%2===0? 'odd' : 'even'} onClick={() => {
                  setSelectedRow(r);
                  setDetailHistory(makeHistoryFor(r.load || r.singlePhaseCurrent || 10));
                }} style={{ cursor: 'pointer' }}>
                  <td>{r.zone}</td>
                  <td>{r.substation}</td>
                  <td>{r.load ?? '-'}</td>
                  <td>{r.singlePhaseVoltage ?? '-'}</td>
                  <td>{r.singlePhaseCurrent ?? '-'}</td>
                  <td>{r.threePhaseVoltage ?? '-'}</td>
                  <td>{r.threePhaseCurrent ?? '-'}</td>
                  <td><div className={`small-badge ${r.status==='fault'? 'fault' : r.status==='warning' ? 'warn' : 'ok'}`}>{(r.status || 'ok').toUpperCase()}</div></td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="ghost" onClick={(e) => { e.stopPropagation(); setRows(prev => { const next = prev.map(x => x.zone === r.zone && x.substation === r.substation ? { ...x, status: 'fault' } : x); reportFaults(next); return next; }); }}>Force Fault</button>
                      <button className="ghost" onClick={(e) => { e.stopPropagation(); setRows(prev => { const next = prev.map(x => x.zone === r.zone && x.substation === r.substation ? { ...x, status: 'ok' } : x); return next; }); }}>Reset</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
            {/* detail panel */}
            <div style={{ width: 320, background: 'var(--surface)', borderRadius: 12, padding: 12, boxShadow: 'var(--shadow-1)' }}>
              {selectedRow ? (
                <>
                  <div style={{ fontWeight: 800 }}>{selectedRow.substation}</div>
                  <div className="muted" style={{ marginBottom: 8 }}>{selectedRow.zone}</div>
                  <div style={{ marginBottom: 8 }}><strong>Status:</strong> <span className={`small-badge ${selectedRow.status==='fault'? 'fault' : selectedRow.status==='warning' ? 'warn' : 'ok'}`}>{(selectedRow.status||'ok').toUpperCase()}</span></div>
                  <div style={{ height: 140 }}>
                    <Line data={{ labels: detailHistory.map(h => new Date(h.t).toLocaleTimeString()), datasets: [{ label: 'Current', data: detailHistory.map(h=>h.v), borderColor: '#0b5cff', backgroundColor: 'rgba(11,92,255,0.06)', tension: 0.2 }] }} options={{ ...lineChartOptions, plugins: { ...lineChartOptions.plugins, legend: { display: false } } }} />
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button className="ghost" onClick={() => { setRows(prev => prev.map(x => x.zone === selectedRow.zone && x.substation === selectedRow.substation ? { ...x, status: 'fault' } : x)); }}>Force Fault</button>
                    <button className="ghost" onClick={() => { setRows(prev => prev.map(x => x.zone === selectedRow.zone && x.substation === selectedRow.substation ? { ...x, status: 'ok' } : x)); }}>Reset</button>
                    <button className="ghost" onClick={() => { setSelectedRow(null); }}>Close</button>
                  </div>
                </>
              ) : (
                <div className="muted">Select a row to see details and quick actions.</div>
              )}
              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'block', marginBottom: 6 }}>Auto inject faults</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" checked={autoInject} onChange={(e) => setAutoInject(e.target.checked)} />
                  <input type="number" value={autoFreq} onChange={(e) => setAutoFreq(Number(e.target.value || 8000))} style={{ width: 100 }} />
                  <div className="muted">ms</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <PageToolbar
          large
          onDownload={() => { const csv = rowsToCSV(rows); downloadCSV(`raw-telemetry-${Date.now()}.csv`, csv); }}
          onSave={() => { saveToLocal('rawTelemetryCSV', rowsToCSV(rows)); alert('Saved telemetry CSV to localStorage (key: rawTelemetryCSV)'); }}
          onPrint={() => printRows(rows)}
        />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ghost" onClick={() => {
              // inject random faults into current rows
              setRows(prev => {
                const next = (prev || []).map(r => {
                  if (Math.random() > 0.85) return { ...r, status: 'fault' };
                  if (Math.random() > 0.75) return { ...r, status: 'warning' };
                  return r;
                });
                // report mutated statuses
                reportFaults(next);
                return next;
              });
            }}>Inject random faults</button>
          </div>
      </div>
    </div>
    </div>
  );
}
