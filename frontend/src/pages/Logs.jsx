import React, { useEffect, useState, useMemo } from "react";
import PageToolbar from "../components/PageToolbar";
import mockData from "../services/mockData";

// Inline icons reused for Logs toolbar
const IconDownload = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 15V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconSave = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M17 21v-8H7v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 3v4h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconPrint = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M6 9V3h12v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 18H4a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M18 21H6v-6h12v6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconEmail = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M3 8l9 6 9-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M21 6H3v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SAMPLE_LOGS = [
  { time: "10:12:03", message: "Zone Kozhikode - WARNING (overload)" },
  { time: "09:58:12", message: "Zone Thrissur - FAULT (short-circuit) - auto-cut applied" },
];

export default function Logs({ logs: propLogs }) {
  const [list, setList] = useState(() => (propLogs && propLogs.length) ? propLogs : mockData.getCachedLogs(30, 200).map(l => ({ time: l.time, zone: l.zone, substation: l.substation, status: l.status, message: l.message })));
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      try {
        const res = await (async () => { try { return await (await import('../services/api')).default.get('/logs'); } catch(e) { return { data: [] }; } })();
        let ll = res.data || [];
        if (!ll || ll.length === 0) ll = mockData.getCachedLogs(30, 200);
        if (!mounted) return;
        setList(ll.map(l => ({ time: l.time, zone: l.zone, substation: l.substation, status: l.status, message: l.message })));
      } catch (e) { /* ignore */ }
    };
    fetch();
    const id = setInterval(fetch, 5000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    return (list || []).filter(l => {
      if (statusFilter !== 'all' && String(l.status || '').toLowerCase() !== statusFilter) return false;
      if (!q) return true;
      return ((l.zone || '').toLowerCase().includes(q) || (l.substation || '').toLowerCase().includes(q) || (l.message || '').toLowerCase().includes(q));
    });
  }, [list, search, statusFilter]);

  const csv = () => {
    const h = ['Time', 'Message'];
    const esc = (v) => { if (v === null || v === undefined) return ''; const s = String(v); return s.includes(',')||s.includes('\n')||s.includes('"') ? '"' + s.replace(/"/g,'""') + '"' : s; };
    const lines = [h.join(',')];
    list.forEach(l => lines.push([l.time, l.message || ''].map(esc).join(',')));
    return lines.join('\n');
  };
  const download = () => { const c = csv(); const blob = new Blob([c], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `logs-${Date.now()}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); };
  const printLogs = () => { const html = `<html><body><h2>System Logs</h2><pre>${list.map(l=>`${l.time} - ${l.message}`).join('\n')}</pre></body></html>`; const w = window.open('', '_blank'); if (!w) return; w.document.write(html); w.document.close(); w.print(); };
  const email = () => { window.location.href = `mailto:?subject=${encodeURIComponent('System Logs')}&body=${encodeURIComponent('Please find attached the log export (download separately).')}`; };

  // Page-level toolbar below provides Download / Save / Print / Share actions.

  return (
    <div className="page-container">
      <h2 className="section-header">System Logs</h2>
      <div style={{ width: '100%', maxWidth: 1000 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0 }}>System Logs</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input placeholder="Search zone / substation / message" value={search} onChange={e=>setSearch(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', minWidth: 320 }} />
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <option value="all">All</option>
              <option value="ok">OK</option>
              <option value="warning">Warning</option>
              <option value="fault">Fault</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 12 }} className="logs-list">
          {filtered.length === 0 ? (
            <div style={{ padding: 18, textAlign: 'center', color: 'var(--muted)' }}>No logs match the filter</div>
          ) : filtered.map((l, idx) => (
            <div key={idx} className="log-item">
              <div className="log-time">{new Date(l.time).toLocaleString()}</div>
              <div className="log-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontWeight: 700 }}>{l.zone} / {l.substation}</div>
                  <div className={`small-badge ${l.status==='fault'? 'fault' : l.status==='warning' ? 'warn' : 'ok'}`}>{String(l.status || 'ok').toUpperCase()}</div>
                </div>
                <div style={{ marginTop: 6, color: 'var(--muted)' }}>{l.message}</div>
              </div>
            </div>
          ))}
        </div>

        <PageToolbar
          large
          onDownload={download}
          onSave={() => { localStorage.setItem('systemLogs', csv()); alert('Saved to localStorage (systemLogs)'); }}
          onPrint={printLogs}
        />
      </div>
    </div>
  );
}
