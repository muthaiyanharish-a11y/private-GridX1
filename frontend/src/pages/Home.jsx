import React, { useEffect, useRef, useState } from "react";
import { Card, Row, Col, Statistic, Table, Badge, Progress, Timeline, notification, Popover, Button } from "antd";
import { StatusPieChart, TrendLineChart } from '../components/Charts';
import { pieChartOptions, lineChartOptions, chartColors } from '../components/ChartConfig';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title
} from 'chart.js';
import { Pie, Line } from 'react-chartjs-2';
import ZONES from "../data/zones";
import api from "../services/api";
import mockData from "../services/mockData";
import "../styles/theme.css";

// Register ChartJS components
// registration is handled centrally in ChartConfig; no-op here

// SVG Icons
const IconMap = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M20.5 3.5l-5 2-6-2-5 2v13l5-2 6 2 5-2v-13z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round"/>
    <path d="M7 5v13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M17 7v11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconTable = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.2" />
    <path d="M3 10h18M10 4v16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

const IconLogs = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M4 6h16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M4 12h16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M4 18h16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

const IconZone = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round"/>
    <circle cx="12" cy="9" r="2" stroke="currentColor" strokeWidth="1" />
  </svg>
);

export default function Home() {
  const [stats, setStats] = useState({
    totalOutages: 0,
    faults: 0,
    warnings: 0,
    activeAlerts: 0,
    uptime: 0,
    mttr: 0, // Mean Time To Repair
    mttf: 0, // Mean Time To Failure
    reliability: 0
  });
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [telemetry, setTelemetry] = useState({});
  const [trendData, setTrendData] = useState({
    labels: [],
    faults: [],
    warnings: []
  });
    // Compute a reasonable Y-axis maximum for the trend chart so lines are easier to read
    const trendVals = [ ...(trendData.faults || []), ...(trendData.warnings || []) ];
    const trendMax = trendVals.length ? Math.max(...trendVals) : 1;
  // protection UI removed — use backend auto-protect where applicable
  const [selectedStatusFilter, setSelectedStatusFilter] = useState(null); // 'ok'|'warning'|'fault' or null
  const heroVideoRef = useRef(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch logs
        // prefer backend logs but fallback to a stable 30-day cached mock
        let logs = [];
        try { const logsRes = await api.get('/logs'); logs = logsRes.data || []; } catch (e) { logs = []; }
        if ((!logs || logs.length === 0)) {
          logs = mockData.getCachedLogs(30, 200);
        }
        const recent = logs
          .filter(log => log.status === 'fault' || log.status === 'warning')
          .slice(-5);

        // Calculate stats
        const faults = logs.filter(log => log.status === 'fault').length;
        const warnings = logs.filter(log => log.status === 'warning').length;

        // Calculate trends (last 7 days)
        const last7Days = Array.from({length: 7}, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - i);
          return d.toISOString().split('T')[0];
        }).reverse();

        const trendsData = last7Days.map(date => {
          const dayLogs = logs.filter(log => log.time.startsWith(date));
          return {
            date,
            faults: dayLogs.filter(log => log.status === 'fault').length,
            warnings: dayLogs.filter(log => log.status === 'warning').length
          };
        });

        // Fetch current telemetry (live snapshot). Use getLiveTelemetry to emulate frequent changes
        let telData = {};
        try { const telemetryRes = await api.get('/telemetry'); telData = telemetryRes.data || {}; } catch (e) { telData = {}; }
        if (!telData || Object.keys(telData).length === 0) {
          telData = mockData.getLiveTelemetry();
        }

        // Calculate reliability metrics
        const totalMinutes = 24 * 60 * 7; // Last 7 days in minutes
        const downtime = logs.reduce((sum, log) => {
          return sum + (log.resolution_time || 60); // Default to 60 minutes if unresolved
        }, 0);
        
        const uptime = ((totalMinutes - downtime) / totalMinutes) * 100;
        const mttr = faults > 0 ? downtime / faults : 0;
        const mttf = faults > 0 ? (totalMinutes - downtime) / faults : totalMinutes;

        setStats({
          totalOutages: faults + warnings,
          faults,
          warnings,
          activeAlerts: Object.values(telData).filter(z => 
            z.substations?.some(s => s.status !== 'ok')
          ).length,
          uptime,
          mttr,
          mttf,
          reliability: (mttf / (mttf + mttr)) * 100
        });

        setTrendData({
          labels: trendsData.map(d => d.date),
          faults: trendsData.map(d => d.faults),
          warnings: trendsData.map(d => d.warnings)
        });
        
        setRecentEvents(recent);
        setTelemetry(telData);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      }
      setLoading(false);
    }

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Control hero video playback based on visibility
  useEffect(() => {
    const videoEl = document.getElementById('kerala-hero-video');
    if (!videoEl) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // play when visible
          try { videoEl.play().catch(()=>{}); } catch (e) { /* ignore */ }
        } else {
          // pause when out of view
          try { videoEl.pause(); } catch (e) { /* ignore */ }
        }
      });
    }, { threshold: 0.5 });

    observer.observe(videoEl);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // previously loaded protect state here; feature removed to simplify UI
  }, []);

  // Calculate zone status counts
  const zoneStatus = ZONES.map(zone => {
    const data = telemetry[zone.id];
    const substations = data?.substations || [];
    return {
      name: zone.name,
      total: zone.substations.length,
      online: substations.length,
      faults: substations.filter(s => s.status === 'fault').length,
      warnings: substations.filter(s => s.status === 'warning').length
    };
  });

  const columns = [
    {
      title: 'Time',
      dataIndex: 'time',
      key: 'time',
      render: (time) => new Date(time).toLocaleString()
    },
    {
      title: 'Zone',
      dataIndex: 'zone',
      key: 'zone'
    },
    {
      title: 'Substation',
      dataIndex: 'substation',
      key: 'substation'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Badge 
          status={status === 'fault' ? 'error' : 'warning'} 
          text={status.toUpperCase()} 
        />
      )
    }
  ];

  // toggleProtect removed — rely on backend protection controls

  // simulateBreak removed; simulation UI removed from Home page

  return (
    <div className="page-bg page-home">
      <div className="page-accent">
        <div style={{ fontWeight: 800, color: 'var(--primary-color)', fontSize: 18 }}>Kerala LT Grid Monitoring</div>
      </div>
      <div className="page-shell">
      <div className="dashboard-container" style={{ padding: 24, background: 'transparent' }}>
      {/* Summary Banner */}
      <div className="dashboard-summary-banner">
        <div className="title">Kerala LT Grid Monitoring</div>
        <div style={{ marginLeft: 12, color: 'var(--muted-1)' }}>
          Latest telemetry across {ZONES.length} zones and {ZONES.reduce((s, z) => s + z.substations.length, 0)} substations — critical alerts highlighted below.
        </div>
      </div>

      {/* Full-bleed hero video background */}
      <div className="segment segment--hero segment--fullbleed" style={{ padding: 0, marginBottom: 12, borderRadius: 12, overflow: 'hidden' }}>
        <video
          id="kerala-hero-video"
          src="/kerala_plains.mp4"
          muted
          playsInline
          loop
          autoPlay
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <div className="hero-overlay">
          <div style={{ padding: 24, color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
            <h2 style={{ margin: 0, fontSize: 28 }}>Live Low-Tension Grid Monitoring</h2>
            <div style={{ marginTop: 6, opacity: 0.95 }}>Realtime telemetry across Kerala — simulated data for demo</div>
          </div>
        </div>
      </div>

  {/* Stats Cards Row */}
  <Row gutter={24} className="stats-row">
        <Col span={6}>
          <Card style={{ borderRadius: '8px', height: '100%' }}>
            <Statistic
              title="Total Zones"
              value={ZONES.length}
              valueStyle={{ color: '#409eff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Substations"
              value={ZONES.reduce((sum, z) => sum + z.substations.length, 0)}
              valueStyle={{ color: '#409eff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Alerts"
              value={stats.activeAlerts}
              valueStyle={{ color: stats.activeAlerts > 0 ? '#f56c6c' : '#67c23a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Outages (30d)"
              value={stats.totalOutages}
              valueStyle={{ color: '#e6a23c' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Substations by Zone (with status) */}
  <div style={{ marginBottom: 32 }}>
  <h2 className="section-title">Substations by Zone</h2>
        {ZONES.map(zone => {
          const tele = telemetry[zone.id] || {};
          const substations = zone.substations.map(ss => {
            const status = tele.substations?.find(s => s.id === ss.id)?.status || 'ok';
            return { ...ss, status };
          });
              return (
            <div key={zone.id} style={{ marginBottom: 18 }}>
              <div className="zone-header">
                <div className="zone-title">{zone.name}</div>
                <div className="zone-actions">
                  {/* control buttons removed from the dashboard for cleaner UI */}
                </div>
              </div>
              <div className="substation-list">
                {substations.map(ss => (
                  <div key={ss.id} className={`substation-card ${ss.status}`} style={{ padding: 10, minWidth: 160, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`substation-status-dot ${ss.status}`} style={{ flex: '0 0 auto' }}></span>
                    <div style={{ flex: 1 }}>{ss.name}</div>
                    {ss.status === 'fault' && <div style={{ marginLeft: 8, fontWeight: 700, color: 'var(--danger-color)' }}>FAULT</div>}
                    {ss.status === 'warning' && <div style={{ marginLeft: 8, fontWeight: 700, color: 'var(--warning-color)' }}>WARNING</div>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row (interactive pie + zone table) */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={14}>
          <Card title="Zone Status Overview" className="chart-card">
            <Table
              dataSource={zoneStatus}
              columns={[
                { title: 'Zone', dataIndex: 'name' },
                { title: 'Total SS', dataIndex: 'total' },
                { title: 'Online', dataIndex: 'online' },
                { 
                  title: 'Status',
                  key: 'status',
                  render: (_, record) => (
                    <span>
                      {record.faults > 0 ? (
                        <Badge status="error" text={`${record.faults} Faults`} style={{marginRight: 8}} />
                      ) : record.warnings > 0 ? (
                        <Badge status="warning" text={`${record.warnings} Warnings`} />
                      ) : (
                        <Badge status="success" text="OK" />
                      )}
                    </span>
                  )
                }
              ]}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card 
            title="Status Distribution" 
            className="chart-card chart-card-top"
            style={{ borderRadius: '8px', height: '100%', minHeight: '380px' }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'center', flexDirection: 'column', height: '100%', minHeight: 280 }}>
              <div style={{ width: 260, height: 200 }}>
                <Pie
                  data={{
                    labels: ['OK', 'Warnings', 'Faults'],
                    datasets: [{
                      data: [
                        (Object.values(telemetry || {}).reduce((acc, z) => acc + (z.substations || []).filter(s=>s.status==='ok').length, 0)) || (ZONES.reduce((sum, z) => sum + z.substations.length, 0) - stats.warnings - stats.faults),
                        stats.warnings,
                        stats.faults
                      ],
                      backgroundColor: ['#67c23a', '#e6a23c', '#f56c6c']
                    }]
                  }}
                  options={{
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'bottom', labels: { padding: 20 } },
                      tooltip: {
                        callbacks: {
                          label: (context) => {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a,b) => a+b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${value} (${percentage}%)`;
                          }
                        }
                      }
                    },
                    interaction: { mode: 'index', intersect: false },
                    animation: {
                      animateRotate: true,
                      animateScale: true
                    },
                    onClick: (evt, elements) => {
                      if (elements && elements.length) {
                        const idx = elements[0].index;
                        const mapping = ['ok','warning','fault'][idx];
                        setSelectedStatusFilter(prev => prev === mapping ? null : mapping);
                      }
                    }
                  }}
                  height={200}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className={`small-badge ${selectedStatusFilter === 'ok' ? 'ok' : ''}`} onClick={() => setSelectedStatusFilter(prev => prev === 'ok' ? null : 'ok')}>OK: {(Object.values(telemetry || {}).reduce((acc, z) => acc + (z.substations || []).filter(s=>s.status==='ok').length, 0)) || (ZONES.reduce((sum, z) => sum + z.substations.length, 0) - stats.warnings - stats.faults)}</button>
                <button className={`small-badge ${selectedStatusFilter === 'warning' ? 'warn' : ''}`} onClick={() => setSelectedStatusFilter(prev => prev === 'warning' ? null : 'warning')}>Warnings: {stats.warnings}</button>
                <button className={`small-badge ${selectedStatusFilter === 'fault' ? 'fault' : ''}`} onClick={() => setSelectedStatusFilter(prev => prev === 'fault' ? null : 'fault')}>Faults: {stats.faults}</button>
              </div>
              {selectedStatusFilter && <div style={{ marginTop: 8 }}><button className="btn small" onClick={() => setSelectedStatusFilter(null)}>Clear filter</button></div>}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Legend and quick help */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="status-indicator status-ok"></span><span style={{ color: 'var(--muted-1)' }}>OK</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="status-indicator status-warning"></span><span style={{ color: 'var(--muted-1)' }}>Warning</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="status-indicator status-fault"></span><span style={{ color: 'var(--muted-1)' }}>Fault</span>
        </div>
        <div style={{ marginLeft: 'auto', color: 'var(--muted-1)' }} title="Mean Time To Repair (MTTR) and Mean Time To Failure (MTTF)">MTTR/MTTF help</div>
      </div>

      {/* Performance Metrics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="System Health">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700 }}>Uptime</div>
                  <div style={{ fontWeight: 800, color: stats.uptime > 99 ? '#16a34a' : stats.uptime > 95 ? '#e6a23c' : '#ef4444' }}>{Math.round(stats.uptime)}%</div>
                </div>
                <Progress percent={Math.round(stats.uptime)} size="small" status={stats.uptime > 99 ? "success" : stats.uptime > 95 ? "normal" : "exception"} />
              </div>
              <div style={{ width: 160 }}>
                <div style={{ fontWeight: 700 }}>Reliability</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: stats.reliability > 99 ? '#16a34a' : '#e6a23c' }}>{Math.round(stats.reliability)}%</div>
                <div className="muted" style={{ fontSize: 12 }}>Higher is better</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>MTTR (Mean Time To Repair)</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{Math.round(stats.mttr)}</div>
                  <div className="muted">minutes</div>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Lower MTTR means faster restoration after an outage.</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>MTTF (Mean Time To Failure)</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{Math.round(stats.mttf / 60)}</div>
                  <div className="muted">hours</div>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Longer MTTF indicates fewer failures over time.</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="7-Day Incident Trend">
            <div style={{ height: 280 }} className="chart-wrapper">
              <Line
                data={{
                  labels: trendData.labels,
                  datasets: [
                    {
                      label: 'Faults',
                      data: trendData.faults,
                      borderColor: 'var(--danger-color)',
                      backgroundColor: 'rgba(220,38,38,0.18)',
                      tension: 0.28,
                      pointRadius: 6,
                      pointHoverRadius: 9,
                      borderWidth: 2,
                      fill: true
                    },
                    {
                      label: 'Warnings',
                      data: trendData.warnings,
                      borderColor: 'var(--warning-color)',
                      backgroundColor: 'rgba(217,119,6,0.14)',
                      tension: 0.28,
                      pointRadius: 6,
                      pointHoverRadius: 9,
                      borderWidth: 2,
                      fill: true
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { mode: 'index', intersect: false },
                  plugins: {
                    legend: { position: 'top', align: 'center' },
                    tooltip: { mode: 'index', intersect: false },
                    title: { display: false }
                  },
                  layout: { padding: { top: 8, right: 12, left: 6, bottom: 6 } },
                  scales: {
                    x: {
                      ticks: { maxRotation: 0, autoSkip: true, color: 'var(--muted-1)' },
                      grid: { display: false }
                    },
                    y: {
                      beginAtZero: true,
                      suggestedMax: trendMax + Math.max(1, Math.ceil(trendMax * 0.25)),
                      ticks: { color: 'var(--muted-1)', precision: 0 },
                      grid: { color: 'rgba(12,18,24,0.06)' }
                    }
                  }
                }}
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* Recent Events */}
      <Row>
        <Col span={24}>
          <Card title="Recent Critical Events" loading={loading}>
            <Table
              dataSource={recentEvents}
              columns={columns}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
    </div>
    </div>
  );
}