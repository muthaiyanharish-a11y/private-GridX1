import React, { useEffect, useState } from "react";
import { Card, Spin, Select } from "antd";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Pie, Line } from "react-chartjs-2";
import api from "../services/api";
import mockData from "../services/mockData";
import ZONES from "../data/zones";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// Helper: get all substations
const allSubstations = ZONES.flatMap(z => z.substations.map(s => ({ ...s, zone: z.name, zoneId: z.id })));

export default function Analysis() {
  const [outages, setOutages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState("all");
  const [selectedSS, setSelectedSS] = useState("all");

  useEffect(() => {
    let mounted = true;
    const fetchOutages = async () => {
      setLoading(true);
      try {
        let logs = [];
        try { const res = await api.get("/logs"); logs = res.data || []; } catch (e) { logs = []; }
        if (!logs || logs.length === 0) {
          logs = mockData.getCachedLogs(30, 800);
        }
        const normalized = logs.map(l => ({
          time: l.time,
          zoneId: l.zoneId || l.zone || l.zoneName,
          zoneName: l.zoneName || l.zone || l.zoneId,
          ssId: l.ssId || l.substation || l.ssName,
          ssName: l.ssName || l.substation || l.ssId,
          status: l.status || 'ok',
          message: l.message || ''
        }));
        const outagesList = normalized.filter(log => log.status === 'fault' || log.status === 'warning');
        if (!mounted) return;
        setOutages(outagesList);
      } catch (error) {
        console.error('Failed to fetch logs:', error);
        const logs = mockData.getMockLogs(60, 800);
        const normalized = logs.map(l => ({
          time: l.time,
          zoneId: l.zoneId || l.zone || l.zoneName,
          zoneName: l.zoneName || l.zone || l.zoneId,
          ssId: l.ssId || l.substation || l.ssName,
          ssName: l.ssName || l.substation || l.ssId,
          status: l.status || 'ok',
          message: l.message || ''
        }));
        if (!mounted) return;
        setOutages(normalized.filter(log => log.status === 'fault' || log.status === 'warning'));
      }
      setLoading(false);
    };

    // run initial fetch and set up polling at a less aggressive rate
    fetchOutages();
    // Poll every 30s
    let id = setInterval(() => {
      // do not poll when tab is hidden
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchOutages();
    }, 30000);

    // when tab becomes visible, fetch immediately
    const onVisibility = () => { if (!document.hidden) fetchOutages(); };
    document.addEventListener('visibilitychange', onVisibility);

    return () => { mounted = false; clearInterval(id); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);

  // Filtered outages
  const filtered = outages.filter(o =>
    (selectedZone === "all" || o.zoneId === selectedZone) &&
    (selectedSS === "all" || o.ssId === selectedSS)
  );

  // Outages per substation
  const outagesBySS = {};
  filtered.forEach(o => { outagesBySS[o.ssName] = (outagesBySS[o.ssName] || 0) + 1; });

  // Outages per day
  const outagesByDay = {};
  filtered.forEach(o => {
    const d = o.time ? o.time.slice(0, 10) : "unknown";
    outagesByDay[d] = (outagesByDay[d] || 0) + 1;
  });

  // Outages by status
  const statusCounts = { fault: 0, warning: 0, ok: 0 };
  filtered.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });

  // Outages per zone
  const outagesByZone = {};
  filtered.forEach(o => { outagesByZone[o.zoneName || o.zone || o.zoneId] = (outagesByZone[o.zoneName || o.zone || o.zoneId] || 0) + 1; });

  // Top 5 substations
  const topSubstations = Object.entries(outagesBySS).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Recent critical
  const recentCritical = filtered
    .filter(o => o.status === 'fault' || o.status === 'warning')
    .sort((a, b) => (b.time || '').localeCompare(a.time || ''))
    .slice(0, 10);

  return (
    <div className="page-container">
      <h2 className="section-header">Grid Analysis</h2>

      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ minWidth: 260, maxWidth: 320 }}>
          <Card title="Filters" size="small">
            <div>Zone:</div>
            <Select style={{ width: '100%' }} value={selectedZone} onChange={setSelectedZone}>
              <Select.Option value="all">All Zones</Select.Option>
              {ZONES.map(z => <Select.Option key={z.id} value={z.id}>{z.name}</Select.Option>)}
            </Select>
            <div style={{ marginTop: 12 }}>Substation:</div>
            <Select style={{ width: '100%' }} value={selectedSS} onChange={setSelectedSS}>
              <Select.Option value="all">All Substations</Select.Option>
              {allSubstations.filter(s => selectedZone === 'all' || s.zoneId === selectedZone).map(s => (
                <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>
              ))}
            </Select>
          </Card>

          <Card title="Summary" size="small" style={{ marginTop: 16 }}>
            <div>Total outages: <b>{filtered.length}</b></div>
            <div>Faults: <b>{statusCounts.fault}</b></div>
            <div>Warnings: <b>{statusCounts.warning}</b></div>
            <div>Zones affected: <b>{Object.keys(outagesByZone).length}</b></div>
          </Card>

          <Card title="Top 5 Substations (Outages)" size="small" style={{ marginTop: 16 }}>
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              {topSubstations.map(([name, count]) => (
                <li key={name}>{name} <b>({count})</b></li>
              ))}
            </ol>
          </Card>

          <Card title="Recent Critical Events" size="small" style={{ marginTop: 16 }}>
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr><th>Time</th><th>Zone</th><th>Substation</th><th>Status</th></tr>
              </thead>
              <tbody>
                {recentCritical.map((e, i) => (
                  <tr key={i}>
                    <td>{e.time ? e.time.replace('T', ' ').slice(0, 16) : ''}</td>
                    <td>{e.zoneName || e.zone || e.zoneId}</td>
                    <td>{e.ssName || e.ssId}</td>
                    <td style={{ color: e.status === 'fault' ? '#f56c6c' : '#e6a23c' }}>{e.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div style={{ flex: 1 }}>
          <h3>Outages in the Past Month</h3>
          {loading ? <Spin /> : (
            <>
              <Card title="Outages by Zone" size="small" style={{ marginBottom: 16, minHeight: 300 }}>
                <Bar data={{ labels: Object.keys(outagesByZone), datasets: [{ label: 'Outages', data: Object.values(outagesByZone), backgroundColor: '#409eff' }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
              </Card>

              <Card title="Outages by Substation" size="small" style={{ marginBottom: 16 }}>
                <Bar data={{ labels: Object.keys(outagesBySS), datasets: [{ label: 'Outages', data: Object.values(outagesBySS), backgroundColor: '#f56c6c' }] }} options={{ indexAxis: 'y', plugins: { legend: { display: false } } }} />
              </Card>

              <div style={{ display: 'flex', gap: 16 }}>
                <Card title="Outages by Day" size="small" style={{ flex: 1 }}>
                  <Line data={{ labels: Object.keys(outagesByDay), datasets: [{ label: 'Outages', data: Object.values(outagesByDay), borderColor: '#409eff', backgroundColor: '#ecf5ff' }] }} options={{ plugins: { legend: { display: false } } }} />
                </Card>

                <Card title="Status Breakdown" size="small" style={{ flex: 1 }}>
                  <Pie data={{ labels: ['Fault', 'Warning', 'OK'], datasets: [{ data: [statusCounts.fault, statusCounts.warning, statusCounts.ok], backgroundColor: ['#f56c6c', '#e6a23c', '#67c23a'] }] }} />
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

