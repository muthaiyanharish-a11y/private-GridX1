import React, { useState, Suspense, lazy, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { BackTop } from "antd";
import Navbar from "./components/Navbar";
import NotificationBar from "./components/NotificationBar";
import "./styles/theme.css";

import Home from "./pages/Home";
import MapView from "./pages/MapView";
import RawData from "./pages/RawData";
import Logs from "./pages/Logs";
import Analysis from "./pages/Analysis";
const Proof = lazy(() => import('./pages/Proof'));

export default function App() {
  // global alerts array (we let MapView push alerts via props.setAlerts)
  const [alerts, setAlerts] = useState([]);
  // lift live logs here so Logs page can show them
  const [logs, setLogs] = useState([]);

  return (
    <Router>
      <div className="app-container">
        <BackTop visibilityHeight={100}>
          <div className="custom-backtop" role="button" aria-label="Back to top">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
              <path d="M12 6l-6 6h4v6h4v-6h4z" />
            </svg>
          </div>
        </BackTop>

        <Navbar alertsCount={alerts.length} />
        <NotificationBar alerts={alerts} />
        <div className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/map" element={<MapView setAlerts={setAlerts} setLogs={setLogs} />} />
            <Route path="/raw" element={<RawData />} />
            <Route path="/logs" element={<Logs logs={logs} />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/poc" element={
              <Suspense fallback={<div style={{padding:20}}>Loading POC...</div>}>
                <Proof />
              </Suspense>
            } />
          </Routes>
        </div>
        <div className="footer">© 2025 KSEB LT Grid Monitor — Demo</div>
      </div>
    </Router>
  );
}
