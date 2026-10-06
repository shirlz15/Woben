/**
 * FORENSIGHT — Report Generator
 * 
 * Generates downloadable forensic reports in PDF (via print) and JSON formats.
 */

// ─── JSON REPORT ────────────────────────────────────────────────
export function downloadJSON(result, filename) {
  const clean = sanitizeForExport(result);
  const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `${filename || 'forensight-report'}.json`);
}

export function downloadTabJSON(state, filename) {
  const report = {
    forensight_version: '1.0.0',
    report_type: 'tab_summary',
    generated_at: new Date().toISOString(),
    scan_timestamp: state.scanTimestamp ? new Date(state.scanTimestamp).toISOString() : null,
    total_media: state.media?.length || 0,
    analyzed_count: state.analyzedCount || 0,
    media_items: (state.media || []).map(m => {
      const r = state.results?.[m.id];
      return {
        id: m.id,
        type: m.type,
        filename: m.filename,
        src: m.src,
        result: r ? sanitizeForExport(r) : null,
      };
    }),
    disclaimer: 'This report summarizes forensic analysis of individual media items. Assessments apply only to analyzed media, not the entire webpage.',
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `${filename || 'forensight-tab-report'}.json`);
}

// ─── PDF REPORT (via printable HTML) ────────────────────────────
export function downloadPDF(result) {
  const html = buildPDFHtml(result);
  const win = window.open('', '_blank', 'width=800,height=1000');
  if (!win) { alert('Please allow popups to download the PDF report.'); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.print(); }, 600);
}

export function downloadTabPDF(state) {
  const html = buildTabPDFHtml(state);
  const win = window.open('', '_blank', 'width=800,height=1000');
  if (!win) { alert('Please allow popups to download the PDF report.'); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.print(); }, 600);
}

// ─── Build Individual Report HTML ───────────────────────────────
function buildPDFHtml(r) {
  const signals = (r.signals || []).filter(s => s.activated);
  const sup = signals.filter(s => s.direction === 'supporting').length;
  const con = signals.filter(s => s.direction === 'contradicting').length;
  const vc = r.verdictStatus === 'manipulated' ? '#ef4444' : r.verdictStatus === 'authentic' ? '#22c55e' : '#f59e0b';
  const hashDisp = r.mediaHash ? `${r.mediaHash.substring(0, 16)}...${r.mediaHash.slice(-8)}` : '—';
  const time = r.analysisTimeMs != null ? `${(r.analysisTimeMs / 1000).toFixed(1)}s` : '—';

  const signalRows = signals.map(s => `
    <tr>
      <td style="font-weight:600">${s.label}</td>
      <td style="text-align:center;color:${s.direction === 'supporting' ? '#ef4444' : s.direction === 'contradicting' ? '#22c55e' : '#f59e0b'}">${s.score != null ? s.score + '%' : '—'}</td>
      <td>${s.direction}</td>
      <td>${s.reliability || '—'}</td>
      <td style="font-size:10px;color:#666">${s.explanation || ''}</td>
    </tr>
  `).join('');

  const explanationRows = (r.explanations || []).map(e => `
    <tr>
      <td style="text-align:center;font-weight:600">${String(e.rank).padStart(2, '0')}</td>
      <td style="font-weight:600">${e.title}</td>
      <td>${e.strength}</td>
      <td style="font-size:10px;color:#666">${e.description || ''}</td>
    </tr>
  `).join('');

  const stabilityRows = (r.stabilityResults || []).map(s => `
    <tr>
      <td>${s.label}</td>
      <td style="text-align:center">${s.score != null ? s.score + '%' : '—'}</td>
      <td>${s.status}</td>
    </tr>
  `).join('');

  const routingActive = (r.activatedModules || []).map(m => `<li>✓ ${m}</li>`).join('');
  const routingSkipped = (r.skippedModules || []).map(m => `<li>○ ${m} (not applicable)</li>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>FORENSIGHT Report — ${r.id || 'Case'}</title>
<style>
  @page { margin: 20mm; size: A4; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a1a; line-height: 1.5; }
  .page-break { page-break-before: always; }
  h1 { font-size: 22px; font-weight: 800; letter-spacing: 0.04em; margin-bottom: 2px; }
  h1 .accent { color: #3b82f6; }
  h2 { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #555; border-bottom: 2px solid #ddd; padding-bottom: 4px; margin: 20px 0 10px; }
  .header { border-bottom: 3px solid #111; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
  .subtitle { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #888; }
  .verdict-box { text-align: center; padding: 20px; margin: 16px 0; border: 2px solid ${vc}; border-radius: 6px; }
  .verdict-label { font-size: 18px; font-weight: 800; color: ${vc}; text-transform: uppercase; letter-spacing: 0.06em; }
  .verdict-score { font-size: 36px; font-weight: 800; color: ${vc}; margin: 4px 0; }
  .verdict-conf { font-size: 11px; color: #555; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 10px 0; }
  .meta-item { padding: 6px 10px; background: #f5f5f5; border-radius: 4px; }
  .meta-label { font-size: 9px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #888; }
  .meta-value { font-size: 11px; font-weight: 600; word-break: break-all; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 10px; }
  th { text-align: left; font-size: 9px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #888; border-bottom: 1px solid #ddd; padding: 4px 8px; }
  td { padding: 4px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  .footer { margin-top: 30px; padding-top: 12px; border-top: 2px solid #ddd; font-size: 9px; color: #999; }
  .demo-badge { display: inline-block; padding: 2px 8px; font-size: 9px; font-weight: 700; color: #92400e; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 3px; margin-left: 8px; }
  .disclaimer { margin-top: 16px; padding: 10px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 4px; font-size: 10px; color: #92400e; }
  ul { padding-left: 16px; }
  li { margin: 2px 0; }
  .summary-quote { padding: 10px; background: #f0f4ff; border-left: 3px solid #3b82f6; border-radius: 0 4px 4px 0; font-style: italic; color: #333; margin: 8px 0; }
</style></head><body>
  <div class="header">
    <div><h1>FOREN<span class="accent">SIGHT</span></h1><div class="subtitle">Digital Forensics Investigation Report</div></div>
    <div style="text-align:right"><div style="font-size:10px;color:#888">Case ID</div><div style="font-weight:600">${r.id || '—'}</div>
      ${r.isDemo ? '<span class="demo-badge">DEMO DATA</span>' : ''}
    </div>
  </div>

  <h2>Case Information</h2>
  <div class="meta-grid">
    <div class="meta-item"><div class="meta-label">Media Hash (SHA-256)</div><div class="meta-value" style="font-size:9px">${hashDisp}</div></div>
    <div class="meta-item"><div class="meta-label">Media Type</div><div class="meta-value">${(r.mediaType || '—').toUpperCase()}</div></div>
    <div class="meta-item"><div class="meta-label">Analysis Duration</div><div class="meta-value">${time}</div></div>
    <div class="meta-item"><div class="meta-label">Timestamp</div><div class="meta-value">${r.timestamp || new Date().toISOString()}</div></div>
    <div class="meta-item"><div class="meta-label">Modules Activated</div><div class="meta-value">${r.activatedModules?.length || 0}</div></div>
    <div class="meta-item"><div class="meta-label">File Name</div><div class="meta-value">${r.fileName || '—'}</div></div>
  </div>

  <h2>Verdict</h2>
  <div class="verdict-box">
    <div class="verdict-label">${r.verdictLabel || '—'}</div>
    <div class="verdict-score">${r.verdictScore != null ? r.verdictScore + '%' : '—'}</div>
    <div class="verdict-conf">Evidence confidence: <strong>${(r.evidenceConfidence || '—').toUpperCase()}</strong></div>
    <div style="margin-top:6px;font-size:10px;color:#666">${r.explanationSummary || ''}</div>
  </div>

  <h2>Signal Breakdown</h2>
  <table><thead><tr><th>Signal</th><th>Score</th><th>Direction</th><th>Reliability</th><th>Explanation</th></tr></thead><tbody>${signalRows}</tbody></table>
  <div style="font-size:10px;color:#888;margin-top:4px">Supporting: ${sup} · Contradicting: ${con}</div>

  ${explanationRows ? `<h2>Why This Verdict?</h2><table><thead><tr><th>#</th><th>Evidence</th><th>Strength</th><th>Description</th></tr></thead><tbody>${explanationRows}</tbody></table>` : ''}
  ${r.explanationSummary ? `<div class="summary-quote">"${r.explanationSummary}"</div>` : ''}

  ${stabilityRows ? `<h2>Forensic Stability Profile</h2><table><thead><tr><th>Transformation</th><th>Score</th><th>Status</th></tr></thead><tbody>${stabilityRows}</tbody></table>` : ''}

  <h2>Adaptive Routing</h2>
  <p style="font-size:10px;margin-bottom:6px">Media type: <strong>${(r.mediaType || '—').toUpperCase()}</strong> · Content: <strong>${r.contentDetected || '—'}</strong></p>
  <ul>${routingActive}${routingSkipped}</ul>

  <div class="disclaimer">
    <strong>Disclaimer:</strong> This forensic report is generated by FORENSIGHT automated analysis. Results should be verified by qualified professionals. ${r.isDemo ? 'This report uses DEMO DATA and does not represent a real analysis.' : ''} Assessments apply only to the analyzed media item.
  </div>

  <div class="footer">
    <div>FORENSIGHT · Adaptive Evidence-Driven Multimodal Digital Forensics</div>
    <div>Generated: ${new Date().toISOString()}</div>
  </div>
</body></html>`;
}

// ─── Build Tab Summary Report HTML ──────────────────────────────
function buildTabPDFHtml(state) {
  const media = state.media || [];
  const results = state.results || {};
  const analyzed = Object.keys(results).length;
  const manip = Object.values(results).filter(r => r.verdictStatus === 'manipulated').length;
  const auth = Object.values(results).filter(r => r.verdictStatus === 'authentic').length;
  const inc = Object.values(results).filter(r => r.verdictStatus === 'inconclusive').length;

  const mediaRows = media.map((m, i) => {
    const r = results[m.id];
    const vc = r ? (r.verdictStatus === 'manipulated' ? '#ef4444' : r.verdictStatus === 'authentic' ? '#22c55e' : '#f59e0b') : '#888';
    return `<tr>
      <td style="text-align:center">${String(i + 1).padStart(2, '0')}</td>
      <td>${m.type?.toUpperCase() || '—'}</td>
      <td style="font-size:9px;word-break:break-all">${m.filename || m.src?.substring(0, 60) || '—'}</td>
      <td style="color:${vc};font-weight:600">${r ? r.verdictLabel || '—' : 'Not analyzed'}</td>
      <td style="text-align:center">${r?.verdictScore != null ? r.verdictScore + '%' : '—'}</td>
      <td>${r?.evidenceConfidence || '—'}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>FORENSIGHT Tab Report</title>
<style>
  @page { margin: 20mm; size: A4; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a1a; line-height: 1.5; }
  h1 { font-size: 22px; font-weight: 800; letter-spacing: 0.04em; }
  h1 .accent { color: #3b82f6; }
  h2 { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #555; border-bottom: 2px solid #ddd; padding-bottom: 4px; margin: 20px 0 10px; }
  .header { border-bottom: 3px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
  .subtitle { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #888; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
  .stat { padding: 10px; background: #f5f5f5; border-radius: 4px; text-align: center; }
  .stat-val { font-size: 22px; font-weight: 800; }
  .stat-lbl { font-size: 9px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #888; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 10px; }
  th { text-align: left; font-size: 9px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #888; border-bottom: 1px solid #ddd; padding: 4px 6px; }
  td { padding: 4px 6px; border-bottom: 1px solid #eee; }
  .footer { margin-top: 30px; padding-top: 12px; border-top: 2px solid #ddd; font-size: 9px; color: #999; }
  .disclaimer { margin-top: 16px; padding: 10px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 4px; font-size: 10px; color: #92400e; }
</style></head><body>
  <div class="header">
    <h1>FOREN<span class="accent">SIGHT</span></h1>
    <div class="subtitle">Tab Forensic Summary Report</div>
  </div>

  <h2>Scan Summary</h2>
  <div class="stats">
    <div class="stat"><div class="stat-val">${media.length}</div><div class="stat-lbl">Media Detected</div></div>
    <div class="stat"><div class="stat-val">${analyzed}</div><div class="stat-lbl">Analyzed</div></div>
    <div class="stat"><div class="stat-val">${media.length - analyzed}</div><div class="stat-lbl">Unavailable</div></div>
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-val" style="color:#ef4444">${manip}</div><div class="stat-lbl">Manipulation Likely</div></div>
    <div class="stat"><div class="stat-val" style="color:#22c55e">${auth}</div><div class="stat-lbl">Authenticity Likely</div></div>
    <div class="stat"><div class="stat-val" style="color:#f59e0b">${inc}</div><div class="stat-lbl">Inconclusive</div></div>
  </div>

  <h2>Media Inventory</h2>
  <table><thead><tr><th>#</th><th>Type</th><th>File</th><th>Verdict</th><th>Score</th><th>Confidence</th></tr></thead><tbody>${mediaRows}</tbody></table>

  <div class="disclaimer">
    <strong>Disclaimer:</strong> This report summarizes forensic analysis of individual media items detected on the scanned webpage. Assessments apply only to analyzed media, not the entire webpage content. Results should be verified by qualified professionals.
  </div>

  <div class="footer">
    <div>FORENSIGHT · Adaptive Evidence-Driven Multimodal Digital Forensics</div>
    <div>Scan: ${state.scanTimestamp ? new Date(state.scanTimestamp).toISOString() : '—'} · Generated: ${new Date().toISOString()}</div>
  </div>
</body></html>`;
}

// ─── Utilities ──────────────────────────────────────────────────
function sanitizeForExport(result) {
  const { _elementIndex, element, ...clean } = result;
  return {
    forensight_version: '1.0.0',
    report_type: 'media_analysis',
    generated_at: new Date().toISOString(),
    ...clean,
  };
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}
