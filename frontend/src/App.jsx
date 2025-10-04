import React, { useState, Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { BackTop, Spin } from "antd";
import { Helmet } from "react-helmet";
import Navbar from "./components/Navbar";
import NotificationBar from "./components/NotificationBar";
import "./styles/theme.css";

// Lazy load all routes
const Home = lazy(() => import("./pages/Home"));
const MapView = lazy(() => import("./pages/MapView"));
const RawData = lazy(() => import("./pages/RawData"));
const Logs = lazy(() => import("./pages/Logs"));
const Analysis = lazy(() => import("./pages/Analysis"));
const Proof = lazy(() => import('./pages/Proof'));

// Loading component
const PageLoader = () => (
  <div className="page-loader">
    <Spin size="large" tip="Loading..." />
  </div>
);

export default function App() {
  // global alerts array (we let MapView push alerts via props.setAlerts)
  const [alerts, setAlerts] = useState([]);
  // lift live logs here so Logs page can show them
  const [logs, setLogs] = useState([]);

  return (
    <Router>
      <div className="app-container">
        <Helmet>
          <title>KSEB LT Grid Monitor</title>
          <meta name="description" content="Real-time monitoring and analysis of KSEB's LT power grid infrastructure" />
          <meta name="keywords" content="KSEB, power grid, monitoring, analysis, electricity" />
          <meta property="og:title" content="KSEB LT Grid Monitor" />
          <meta property="og:description" content="Real-time monitoring and analysis of KSEB's LT power grid infrastructure" />
          <meta property="og:type" content="website" />
          <meta name="theme-color" content="#1890ff" />
        </Helmet>
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
            <Route path="/" element={<Suspense fallback={<PageLoader />}><Home /></Suspense>} />
            <Route path="/map" element={<Suspense fallback={<PageLoader />}><MapView setAlerts={setAlerts} setLogs={setLogs} /></Suspense>} />
            <Route path="/raw" element={<Suspense fallback={<PageLoader />}><RawData /></Suspense>} />
            <Route path="/logs" element={<Suspense fallback={<PageLoader />}><Logs logs={logs} /></Suspense>} />
            <Route path="/analysis" element={<Suspense fallback={<PageLoader />}><Analysis /></Suspense>} />
            <Route path="/poc" element={<Suspense fallback={<PageLoader />}><Proof /></Suspense>} />
          </Routes>
        </div>
        <div className="footer">© 2025 KSEB LT Grid Monitor — Demo</div>
      </div>
    </Router>
  );
}
