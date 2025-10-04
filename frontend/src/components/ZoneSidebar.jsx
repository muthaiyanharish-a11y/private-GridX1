import React from "react";

/* Sidebar expects zones array and selectedId and onSelect(zone) */
export default function ZoneSidebar({ zones = [], selectedId = null, onSelect = () => {} }) {
  const [filter, setFilter] = React.useState("");
  const getColor = (status) => {
    if (status === "ok") return "ok";
    if (status === "warning") return "warn";
    if (status === "fault") return "fault";
    return "";
  };

  const list = (zones || []).filter(z => z.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <aside className="sidebar" aria-label="Zones">
      <h3 style={{ margin: 0, marginBottom: 8 }}>Zones</h3>
      <div style={{ marginBottom: 12, color: "#475569" }}>Click a zone to focus</div>
      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="Filter zones..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)' }}
        />
      </div>
      <div>
        {list.map((z) => (
          <div
            key={z.id}
            className={`zone-row ${selectedId === z.id ? "active" : ""}`}
            onClick={() => onSelect(z)}
            role="button"
            tabIndex={0}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderRadius: 8, cursor: 'pointer', marginBottom: 8, background: selectedId === z.id ? 'rgba(24,144,255,0.06)' : 'transparent' }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{z.name}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{z.substations?.length ?? 0} substations</div>
            </div>
            <div className={`status-dot ${getColor(z.status)}`} />
          </div>
        ))}
      </div>
    </aside>
  );
}
