import React from 'react';

// Shared page-level toolbar for export/share actions
export default function PageToolbar({ onDownload, onSave, onPrint, large = false }) {
  const cls = large ? 'icon-btn large' : 'icon-btn';

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

  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 12 }}>
      <button onClick={onDownload} className={cls} data-tooltip="Download CSV" aria-label="Download CSV"><IconDownload className="icon-svg" />{large ? '\u00A0Download' : null}</button>
      <button onClick={onSave} className={cls} data-tooltip="Save locally" aria-label="Save locally"><IconSave className="icon-svg" />{large ? '\u00A0Save' : null}</button>
      <button onClick={onPrint} className={cls} data-tooltip="Print" aria-label="Print"><IconPrint className="icon-svg" />{large ? '\u00A0Print' : null}</button>
    </div>
  );
}
