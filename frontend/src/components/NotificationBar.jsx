import React from "react";

/* Simple top banner to show array of alerts passed from App */
export default function NotificationBar({ alerts = [] }) {
  if (!alerts || alerts.length === 0) {
    return null;
  }

  return (
    <div className="alert-row" role="status" aria-live="polite">
      <strong style={{ marginRight: 8 }}>Alerts:</strong>
      <div style={{ display: "flex", gap: 12, overflowX: "auto" }}>
        {alerts.map((a, i) => (
          <div key={i} style={{ padding: "6px 12px", background:"#fff2f2", borderRadius:8, color:"#7f1d1d", border:"1px solid #ffd6d6" }}>
            {a.message}
          </div>
        ))}
      </div>
    </div>
  );
}
