import React, { useEffect, useRef, useState } from "react";
import ZONES from "../data/zones";
import api from "../services/api";
import { Line } from 'react-chartjs-2';
import { lineChartOptions } from '../components/ChartConfig';
import { Card, Button, Select, InputNumber, Space, Badge } from 'antd';
import "../styles/glass.css";
import "../styles/responsive.css";
import "../styles/poc.css";

// Substation Card Component
const SubstationCard = ({ name, data, onTriggerFault }) => (
  <div className={`substation-card ${data.relay ? 'active' : 'fault'}`}>
    <h3>{name}</h3>
    <div className="readings">
      <div className="reading-item">
        <span>Current:</span>
        <span className="value">{data.curr.toFixed(1)} A</span>
      </div>
      <div className="reading-item">
        <span>Voltage:</span>
        <span className="value">{data.volt.toFixed(1)} V</span>
      </div>
    </div>
    <div className="status">
      <div className={`status-indicator ${data.relay ? 'online' : 'offline'}`}>
        {data.relay ? 'ONLINE' : 'FAULT'}
      </div>
    </div>
    <Button
      type="primary"
      danger
      className="interactive-button"
      onClick={onTriggerFault}
      disabled={!data.relay}
    >
      Trigger Fault
    </Button>
  </div>
);

export default function Proof() {
  // State management
  const [line1, setLine1] = useState({ curr: 30.0, volt: 220.0, relay: true });
  const [line2, setLine2] = useState({ curr: 28.0, volt: 220.0, relay: true });
  const [logs, setLogs] = useState([]);
  const [simMode, setSimMode] = useState("auto");
  const [simInterval, setSimInterval] = useState(700);
  const [selectedZoneId, setSelectedZoneId] = useState(ZONES[0]?.id || "");
  const [subAId, setSubAId] = useState(ZONES[0]?.substations[0]?.id || "");
  const [subBId, setSubBId] = useState(ZONES[0]?.substations[1]?.id || ZONES[0]?.substations[0]?.id || "");

  // Derived state
  const currentZone = ZONES.find((z) => z.id === selectedZoneId) || ZONES[0];
  const subAName = currentZone?.substations?.find((s) => s.id === subAId)?.name || "Substation A";
  const subBName = currentZone?.substations?.find((s) => s.id === subBId)?.name || "Substation B";

  // Data for charts
  const [history1, setHistory1] = useState(() => 
    Array.from({ length: 24 }, (_, i) => ({ t: Date.now() - (23 - i) * 1000, v: 0 }))
  );
  const [history2, setHistory2] = useState(() => 
    Array.from({ length: 24 }, (_, i) => ({ t: Date.now() - (23 - i) * 1000, v: 0 }))
  );

  // Refs
  const autoTimerRef = useRef(null);

  // Logging function
  const log = (text) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [{ time, text }, ...prev].slice(0, 500));
  };

  // Simulation functions
  const updateRandomWalk = () => {
    setLine1((prev) => {
      if (!prev.relay) return { ...prev, curr: 0 };
      let curr = prev.curr + (Math.random() - 0.5) * 2.5;
      if (curr < 0) curr = 0.05;
      let volt = prev.volt + (Math.random() - 0.5) * 1.5;
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
    autoTimerRef.current = setInterval(() => {
      updateRandomWalk();
      if (Math.random() < 0.02) simulateFaultOn(1);
    }, simInterval);
    log("Auto simulation started");
  };

  const stopAuto = () => {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
      log("Auto stopped");
    }
  };

  const simulateFaultOn = (line) => {
    if (line === 1) {
      setLine1((p) => ({ ...p, curr: 200, volt: 290, relay: false }));
      setHistory1((h) => [...h.slice(-23), { t: Date.now(), v: 200 }]);
      log("Line 1 TRIPPED (relay opened)");
      setTimeout(() => {
        setLine1((p) => ({ ...p, relay: true }));
        log("Line 1 re-enabled");
      }, 8000);
    } else {
      setLine2((p) => ({ ...p, curr: 200, volt: 290, relay: false }));
      setHistory2((h) => [...h.slice(-23), { t: Date.now(), v: 200 }]);
      log("Line 2 TRIPPED (relay opened)");
      setTimeout(() => {
        setLine2((p) => ({ ...p, relay: true }));
        log("Line 2 re-enabled");
      }, 8000);
    }
  };

  // Effect for auto simulation
  useEffect(() => {
    if (simMode === "auto") startAuto();
    return () => stopAuto();
  }, [simMode, simInterval]);

  return (
    <div className="poc-container">
      <header className="poc-header">
        <h1>LV Line Simulator</h1>
        <div className="subtitle">Real-time Power Grid Monitoring</div>
        <Badge.Ribbon 
          text={simMode === "auto" ? "Auto Mode" : "Manual Mode"} 
          color={simMode === "auto" ? "blue" : "purple"} 
        />
      </header>

      <div className="poc-grid">
        <Card className="simulator-controls" title="Simulation Controls">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div className="control-group">
              <label>Simulation Mode</label>
              <Select
                value={simMode}
                onChange={setSimMode}
                style={{ width: '100%' }}
                options={[
                  { value: 'auto', label: 'Automatic' },
                  { value: 'manual', label: 'Manual' }
                ]}
              />
            </div>
            
            <div className="control-group">
              <label>Update Interval (ms)</label>
              <InputNumber
                min={100}
                max={5000}
                value={simInterval}
                onChange={val => setSimInterval(val)}
                style={{ width: '100%' }}
              />
            </div>

            <div className="control-group">
              <label>Zone Selection</label>
              <Select
                value={selectedZoneId}
                onChange={(zid) => {
                  setSelectedZoneId(zid);
                  const zone = ZONES.find((z) => z.id === zid);
                  if (zone?.substations) {
                    setSubAId(zone.substations[0]?.id ?? "");
                    setSubBId(zone.substations[1]?.id ?? zone.substations[0]?.id ?? "");
                  }
                }}
                style={{ width: '100%' }}
              >
                {ZONES.map((z) => (
                  <Select.Option key={z.id} value={z.id}>{z.name}</Select.Option>
                ))}
              </Select>
            </div>
          </Space>
        </Card>

        <Card className="simulation-view">
          <Space direction="vertical" style={{ width: '100%' }}>
            <SubstationCard
              name={subAName}
              data={line1}
              onTriggerFault={() => simulateFaultOn(1)}
            />
            
            <div className={`power-line ${line1.relay && line2.relay ? 'active' : 'fault'}`} />
            
            <SubstationCard
              name={subBName}
              data={line2}
              onTriggerFault={() => simulateFaultOn(2)}
            />
          </Space>
        </Card>

        <Card className="chart-container">
          <Line
            data={{
              labels: history1.map(h => new Date(h.t).toLocaleTimeString()),
              datasets: [
                {
                  label: subAName,
                  data: history1.map(h => h.v),
                  borderColor: '#2196f3',
                  backgroundColor: 'rgba(33, 150, 243, 0.1)',
                  tension: 0.2
                },
                {
                  label: subBName,
                  data: history2.map(h => h.v),
                  borderColor: '#4caf50',
                  backgroundColor: 'rgba(76, 175, 80, 0.1)',
                  tension: 0.2
                }
              ]
            }}
            options={{
              ...lineChartOptions,
              plugins: {
                ...lineChartOptions.plugins,
                legend: { position: 'bottom' }
              }
            }}
          />
        </Card>

        <Card className="log-panel">
          <h3>System Logs</h3>
          <div className="log-entries">
            {logs.map((log, index) => (
              <div key={index} className="log-entry">
                <span className="log-time">{log.time}</span>
                <span className="log-message">{log.text}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}