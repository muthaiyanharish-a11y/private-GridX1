import React from "react";
import { NavLink } from "react-router-dom";

export default function Navbar({ alertsCount = 0 }) {
  // removed Google Translate integration (no external translate widget)

  return (
    <div className="navbar">
      <div className="nav-left">
        <div style={{ width:56, height:56, borderRadius:8, background:"white", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <img src="/kseb_icon.png" alt="hub" style={{ width:38 }} onError={(ev)=>{ ev.target.style.display='none'; }} />
        </div>
        <div className="brand">
          <h1>KSEB LT Grid Monitor</h1>
          <small>Kerala — Live Monitoring</small>
        </div>
      </div>

  <div style={{ display:"flex", gap:14, alignItems:"center" }}>
        <div className="nav-links">
          <NavLink to="/" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>Home</NavLink>
          <NavLink to="/map" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>Map</NavLink>
          <NavLink to="/analysis" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>Analysis</NavLink>
          <NavLink to="/poc" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>Proof of Concept</NavLink>
          <NavLink to="/raw" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>Raw Data</NavLink>
          <NavLink to="/logs" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>Logs</NavLink>
        </div>

        <div style={{ marginLeft:10 }}>
          {/* Removed bell icon as requested */}
        </div>
      </div>
    </div>
  );
}
