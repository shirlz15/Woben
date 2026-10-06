/**
 * FORENSIGHT — Side Panel Components Bundle
 * 
 * All visualization components adapted for the narrow side panel.
 * Each function takes (result, container) and renders into the container.
 */

// ─── CONSTELLATION COLORS ───────────────────────────────────────
const COLORS = {
  supporting: '#ef4444', contradicting: '#22c55e', inconclusive: '#f59e0b',
  unavailable: '#3d4660', authentic: '#22c55e', manipulated: '#ef4444', pending: '#5d6882',
};

function nodeColor(dir) { return COLORS[dir] || COLORS.unavailable; }
function verdictColor(status) { return COLORS[status] || COLORS.pending; }

// ═══════════════════════════════════════════════════════════════
// VERDICT CORE
// ═══════════════════════════════════════════════════════════════
export function renderVerdict(result, el) {
  const { verdictStatus, verdictScore, verdictLabel, evidenceConfidence, signals, isDemo } = result;
  const active = (signals || []).filter(s => s.activated);
  const sup = active.filter(s => s.direction === 'supporting').length;
  const con = active.filter(s => s.direction === 'contradicting').length;

  let summary = '';
  if (sup > 0) summary += `${sup} independent signal${sup !== 1 ? 's' : ''} support the ${verdictStatus === 'manipulated' ? 'manipulation' : 'authenticity'} hypothesis.`;
  if (con > 0) summary += ` ${con} signal${con !== 1 ? 's' : ''} contradict.`;

  const scoreHtml = verdictScore != null
    ? `<div class="sp-verdict-score" style="color:${verdictColor(verdictStatus)}">${verdictScore}<span style="font-size:0.6em;opacity:0.6">%</span></div>`
    : `<div class="sp-verdict-score" style="color:var(--fs-text-tertiary)">—</div>`;

  el.innerHTML = `
    <div class="sp-panel">
      <div class="sp-verdict" data-status="${verdictStatus}">
        ${isDemo ? '<div style="margin-bottom:8px"><span class="sp-demo-badge">DEMO</span></div>' : ''}
        <div class="sp-verdict-label ${verdictStatus}">${verdictLabel || 'Awaiting analysis'}</div>
        ${scoreHtml}
        ${evidenceConfidence ? `<div class="sp-verdict-confidence">Evidence confidence: <strong>${evidenceConfidence}</strong></div>` : ''}
        <div class="sp-verdict-summary">${summary}</div>
        ${verdictStatus === 'inconclusive' ? '<div class="sp-verdict-recommendation">⚠ Verify Manually</div>' : ''}
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
// EVIDENCE CONSTELLATION
// ═══════════════════════════════════════════════════════════════
export function renderConstellation(result, el) {
  const active = (result.signals || []).filter(s => s.activated);
  if (active.length === 0) {
    el.innerHTML = `<div class="sp-panel"><div class="sp-panel-header"><span class="sp-panel-title">Evidence Constellation</span></div><div class="sp-panel-body" style="text-align:center;color:var(--fs-text-tertiary);padding:24px">No active signals</div></div>`;
    return;
  }

  const size = 300, cx = size / 2, cy = size / 2, r = size * 0.34, nr = 14, cr = 22;
  const positions = active.map((s, i) => {
    const a = (i / active.length) * Math.PI * 2 - Math.PI / 2;
    return { s, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, a };
  });

  let lines = '', nodes = '';

  // Links to center
  positions.forEach(({ s, x, y }) => {
    const c = nodeColor(s.direction);
    const dash = s.direction === 'contradicting' ? 'stroke-dasharray="6 4"' : s.direction === 'inconclusive' ? 'stroke-dasharray="3 3"' : '';
    lines += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${c}" stroke-opacity="0.4" stroke-width="1.5" ${dash}/>`;
  });

  // Evidence nodes
  positions.forEach(({ s, x, y, a }) => {
    const c = nodeColor(s.direction);
    const sc = s.score != null ? `${s.score}%` : '—';
    const ldx = Math.cos(a) * 30, ldy = Math.sin(a) * 30;
    const anc = Math.abs(a) < 0.1 || Math.abs(a - Math.PI) < 0.1 ? 'middle' : a > -Math.PI / 2 && a < Math.PI / 2 ? 'start' : 'end';
    nodes += `
      <g class="sp-constellation-node" data-id="${s.id}">
        <circle cx="${x}" cy="${y}" r="${nr}" fill="${c}" fill-opacity="0.12" stroke="${c}" stroke-width="1.5" stroke-opacity="0.6"/>
        <circle cx="${x}" cy="${y}" r="3.5" fill="${c}" fill-opacity="0.9"/>
        <text x="${x + ldx}" y="${y + ldy - 5}" text-anchor="${anc}" font-family="Inter,sans-serif" font-size="9" font-weight="600" letter-spacing="0.06em" fill="var(--fs-text-secondary)" text-transform="uppercase">${s.label.toUpperCase()}</text>
        <text x="${x + ldx}" y="${y + ldy + 7}" text-anchor="${anc}" font-family="JetBrains Mono,monospace" font-size="10" font-weight="600" fill="${c}">${sc}</text>
      </g>`;
  });

  // Center node
  const vc = verdictColor(result.verdictStatus);
  const vs = result.verdictScore != null ? `${result.verdictScore}%` : '—';
  nodes += `
    <circle cx="${cx}" cy="${cy}" r="${cr}" fill="${vc}" fill-opacity="0.1" stroke="${vc}" stroke-width="2" stroke-opacity="0.5"/>
    <circle cx="${cx}" cy="${cy}" r="5" fill="${vc}"/>
    <text x="${cx}" y="${cy - 7}" text-anchor="middle" font-family="Inter,sans-serif" font-size="9" font-weight="700" letter-spacing="0.06em" fill="${vc}">VERDICT</text>
    <text x="${cx}" y="${cy + 13}" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="18" font-weight="800" fill="${vc}">${vs}</text>`;

  el.innerHTML = `
    <div class="sp-panel"><div class="sp-panel-header"><span class="sp-panel-title">Evidence Constellation</span></div>
    <div class="sp-panel-body"><svg class="sp-constellation-svg" viewBox="0 0 ${size} ${size}">${lines}${nodes}</svg></div></div>`;

  // Tooltips on hover
  el.querySelectorAll('.sp-constellation-node').forEach(node => {
    node.style.cursor = 'pointer';
    node.addEventListener('click', () => {
      const sig = active.find(s => s.id === node.dataset.id);
      if (sig) alert(`${sig.label}\n${sig.explanation}`);
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// SIGNAL BARS
// ═══════════════════════════════════════════════════════════════
export function renderSignals(result, el) {
  const active = (result.signals || []).filter(s => s.activated);
  const inactive = (result.signals || []).filter(s => !s.activated);
  const dirLabel = d => ({ supporting: 'Supporting', contradicting: 'Contradicting', inconclusive: 'Inconclusive', unavailable: 'N/A' })[d] || d;

  const items = active.map(s => {
    const sc = s.score != null ? `${s.score}%` : '—';
    const w = s.score != null ? s.score : 0;
    return `
      <div class="sp-signal-item" data-id="${s.id}">
        <div class="sp-signal-header">
          <span class="sp-signal-name">${s.label}</span>
          <div class="sp-signal-info">
            <span class="sp-signal-score" style="color:${nodeColor(s.direction)}">${sc}</span>
            <span class="sp-signal-dir ${s.direction}">${dirLabel(s.direction)}</span>
          </div>
        </div>
        <div class="sp-bar-track"><div class="sp-bar-fill ${s.direction}" style="width:0%" data-w="${w}%"></div></div>
        <div class="sp-signal-explanation">${s.explanation || ''}</div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="sp-panel"><div class="sp-panel-header"><span class="sp-panel-title">Forensic Signal Breakdown</span>
    <span style="font-size:9px;color:var(--fs-text-tertiary)">${active.length} active${inactive.length ? ` · ${inactive.length} N/A` : ''}</span></div>
    <div class="sp-panel-body" style="display:flex;flex-direction:column;gap:8px">${items}</div></div>`;

  // Animate bars
  requestAnimationFrame(() => setTimeout(() => {
    el.querySelectorAll('.sp-bar-fill').forEach(f => { f.style.width = f.dataset.w; });
  }, 80));

  // Toggle explanation
  el.querySelectorAll('.sp-signal-item').forEach(item => {
    item.addEventListener('click', () => item.classList.toggle('expanded'));
  });
}

// ═══════════════════════════════════════════════════════════════
// EVIDENCE MATRIX
// ═══════════════════════════════════════════════════════════════
export function renderMatrix(result, el) {
  const active = (result.signals || []).filter(s => s.activated);
  if (active.length < 2) {
    el.innerHTML = `<div class="sp-panel"><div class="sp-panel-header"><span class="sp-panel-title">Evidence Agreement</span></div><div class="sp-panel-body" style="text-align:center;color:var(--fs-text-tertiary);padding:16px">Insufficient signals</div></div>`;
    return;
  }

  // Build lookup
  const lookup = {};
  (result.relationships || []).forEach(r => {
    lookup[`${r.signalA}-${r.signalB}`] = r.agreement;
    lookup[`${r.signalB}-${r.signalA}`] = r.agreement;
  });

  const cellClass = v => ({ '—': 'self', '+': 'support', '?': 'uncertain', '×': 'contradict' })[v] || 'uncertain';

  let header = '<th></th>' + active.map(s => `<th>${s.label.split(' ')[0].substring(0, 5)}</th>`).join('');
  let rows = active.map(a => {
    let cells = `<td>${a.label}</td>`;
    active.forEach(b => {
      if (a.id === b.id) { cells += `<td><span class="sp-matrix-cell self">—</span></td>`; }
      else {
        const v = lookup[`${a.id}-${b.id}`] || '?';
        cells += `<td><span class="sp-matrix-cell ${cellClass(v)}">${v}</span></td>`;
      }
    });
    return `<tr>${cells}</tr>`;
  }).join('');

  el.innerHTML = `
    <div class="sp-panel"><div class="sp-panel-header"><span class="sp-panel-title">Evidence Agreement</span></div>
    <div class="sp-panel-body" style="overflow-x:auto">
      <table class="sp-matrix"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>
      <div class="sp-matrix-legend">
        <span><span class="sp-matrix-cell support" style="display:inline-flex;width:16px;height:16px;font-size:9px">+</span> Supporting</span>
        <span><span class="sp-matrix-cell uncertain" style="display:inline-flex;width:16px;height:16px;font-size:9px">?</span> Uncertain</span>
        <span><span class="sp-matrix-cell contradict" style="display:inline-flex;width:16px;height:16px;font-size:9px">×</span> Contradictory</span>
      </div>
    </div></div>`;
}

// ═══════════════════════════════════════════════════════════════
// EXPLANATION PANEL
// ═══════════════════════════════════════════════════════════════
export function renderExplanation(result, el) {
  const { explanations, explanationSummary } = result;
  if (!explanations || !explanations.length) {
    el.innerHTML = `<div class="sp-panel"><div class="sp-panel-header"><span class="sp-panel-title">Why This Verdict?</span></div><div class="sp-panel-body" style="text-align:center;color:var(--fs-text-tertiary);padding:16px">Awaiting analysis</div></div>`;
    return;
  }

  const strengthLabel = s => ({ strong: 'Strong supporting evidence', moderate: 'Moderate supporting evidence', weak: 'Weak evidence', none: 'No decisive evidence' })[s] || '';

  const items = explanations.map(e => `
    <div class="sp-explanation-item" data-rank="${e.rank}">
      <div class="sp-explanation-rank">${String(e.rank).padStart(2, '0')}</div>
      <div>
        <div class="sp-explanation-title">${e.title}</div>
        <div class="sp-explanation-strength ${e.strength}">${strengthLabel(e.strength)}</div>
        <div class="sp-explanation-desc">${e.description || ''}</div>
      </div>
    </div>`).join('');

  el.innerHTML = `
    <div class="sp-panel"><div class="sp-panel-header"><span class="sp-panel-title">Why This Verdict?</span></div>
    <div class="sp-panel-body" style="display:flex;flex-direction:column;gap:4px">
      ${items}
      ${explanationSummary ? `<div class="sp-explanation-summary">${explanationSummary}</div>` : ''}
    </div></div>`;

  el.querySelectorAll('.sp-explanation-item').forEach(item => {
    item.addEventListener('click', () => item.classList.toggle('expanded'));
  });
}

// ═══════════════════════════════════════════════════════════════
// STABILITY PROFILE
// ═══════════════════════════════════════════════════════════════
export function renderStability(result, el) {
  const { stabilityResults } = result;
  if (!stabilityResults || !stabilityResults.length) {
    el.innerHTML = `<div class="sp-panel"><div class="sp-panel-header"><span class="sp-panel-title">Forensic Stability</span></div><div class="sp-panel-body" style="text-align:center;color:var(--fs-text-tertiary);padding:16px">Stability test not performed</div></div>`;
    return;
  }

  const valid = stabilityResults.filter(r => r.score != null);
  const nonOrig = stabilityResults.filter(r => r.transformation !== 'original' && r.score != null);
  const avg = nonOrig.length ? Math.round(nonOrig.reduce((s, r) => s + r.score, 0) / nonOrig.length) : null;
  const hasUnstable = stabilityResults.some(r => r.status === 'unstable');
  const hasChanged = stabilityResults.some(r => r.status === 'changed');
  const overallStatus = hasUnstable ? 'unstable' : hasChanged ? 'changed' : 'stable';
  const lineColor = overallStatus === 'stable' ? '#22c55e' : overallStatus === 'changed' ? '#f59e0b' : '#ef4444';

  // Mini chart
  const W = 280, H = 100, pl = 30, pr = 10, pt = 10, pb = 20;
  const cw = W - pl - pr, ch = H - pt - pb;
  const scores = valid.map(r => r.score);
  const mn = Math.max(0, Math.min(...scores) - 10), mx = Math.min(100, Math.max(...scores) + 10);
  const rng = mx - mn || 20;
  const yS = v => pt + ch - ((v - mn) / rng) * ch;
  const xS = (i) => pl + (i / (valid.length - 1 || 1)) * cw;

  let grid = '';
  [mn, mn + rng / 2, mx].forEach(v => {
    const y = yS(v);
    grid += `<line x1="${pl}" y1="${y}" x2="${W - pr}" y2="${y}" stroke="var(--fs-border-subtle)" stroke-width="0.5"/>
             <text x="${pl - 4}" y="${y + 3}" text-anchor="end" font-family="JetBrains Mono,monospace" font-size="8" fill="var(--fs-text-disabled)">${Math.round(v)}</text>`;
  });

  const pts = valid.map((r, i) => `${xS(i)},${yS(r.score)}`).join(' ');
  const area = [`${xS(0)},${pt + ch}`, ...valid.map((r, i) => `${xS(i)},${yS(r.score)}`), `${xS(valid.length - 1)},${pt + ch}`].join(' ');
  let dots = valid.map((r, i) => `<circle cx="${xS(i)}" cy="${yS(r.score)}" r="3" fill="${lineColor}" stroke="var(--fs-bg-primary)" stroke-width="1.5"/>`).join('');
  let labels = valid.map((r, i) => `<text x="${xS(i)}" y="${pt + ch + 14}" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="8" fill="var(--fs-text-disabled)">${r.label.charAt(0)}</text>`).join('');

  // Robustness
  const statusSym = s => ({ stable: '✓', changed: '⚠', unstable: '✕' })[s] || '—';
  const statusLbl = s => ({ stable: 'Stable', changed: 'Changed', unstable: 'Unstable' })[s] || 'Untested';
  const robItems = stabilityResults.filter(r => r.transformation !== 'original').map(r =>
    `<div class="sp-robustness-item"><span>${r.label}</span><span class="sp-robustness-status ${r.status}">${statusSym(r.status)} ${statusLbl(r.status)}</span></div>`
  ).join('');

  el.innerHTML = `
    <div class="sp-panel"><div class="sp-panel-header"><span class="sp-panel-title">Forensic Stability</span></div>
    <div class="sp-panel-body">
      <svg class="sp-stability-svg" viewBox="0 0 ${W} ${H}">${grid}
        <polygon points="${area}" fill="${lineColor}" opacity="0.08"/>
        <polyline points="${pts}" fill="none" stroke="${lineColor}" stroke-width="2" stroke-linejoin="round"/>
        ${dots}${labels}
      </svg>
      <div class="sp-stability-summary">
        <div><div class="sp-stability-label">Stability</div><div class="sp-stability-value" style="color:${lineColor}">${avg != null ? avg + '%' : '—'}</div></div>
        <span class="sp-stability-badge ${overallStatus}">${overallStatus === 'unstable' ? 'UNSTABLE' : overallStatus.toUpperCase()}</span>
      </div>
      <div style="margin-top:8px">${robItems}</div>
    </div></div>`;
}

// ═══════════════════════════════════════════════════════════════
// INVESTIGATION FLOW
// ═══════════════════════════════════════════════════════════════
const STAGE_LABELS = {
  media_detected: 'Media Detected', modality_identified: 'Modality Identified',
  tests_selected: 'Forensic Tests Selected', evidence_collected: 'Evidence Collected',
  contradiction_check: 'Contradiction Check', localization: 'Localization',
  stability_test: 'Stability Test', final_verdict: 'Final Verdict',
};

export function renderFlow(result, el) {
  const flow = result.investigationFlow || [];
  if (!flow.length) {
    el.innerHTML = `<div class="sp-panel"><div class="sp-panel-header"><span class="sp-panel-title">Investigation Flow</span></div><div class="sp-panel-body" style="text-align:center;color:var(--fs-text-tertiary);padding:16px">Awaiting analysis</div></div>`;
    return;
  }

  const steps = flow.map(f => {
    const mark = f.status === 'completed' ? '✓' : f.status === 'running' ? '●' : f.status === 'unavailable' ? '—' : '';
    return `<div class="sp-flow-step ${f.status}"><div class="sp-flow-marker">${mark}</div><span class="sp-flow-name">${STAGE_LABELS[f.stage] || f.stage}</span></div>`;
  }).join('');

  el.innerHTML = `<div class="sp-panel"><div class="sp-panel-header"><span class="sp-panel-title">Investigation Flow</span></div><div class="sp-panel-body"><div class="sp-flow">${steps}</div></div></div>`;
}

// ═══════════════════════════════════════════════════════════════
// FORENSIC TIMELINE
// ═══════════════════════════════════════════════════════════════
const TRACK_COLORS = { visual: '#ef4444', temporal: '#f59e0b', audio: '#3b82f6', lip_sync: '#a855f7', face: '#ec4899' };
const TRACK_LABELS = { visual: 'VISUAL', temporal: 'TEMPORAL', audio: 'AUDIO', lip_sync: 'LIP-SYNC', face: 'FACE' };

export function renderTimeline(result, el) {
  const { suspiciousSegments, mediaType } = result;
  if (mediaType !== 'video' && mediaType !== 'audio') {
    el.innerHTML = '';
    return;
  }
  if (!suspiciousSegments || !suspiciousSegments.length) {
    el.innerHTML = `<div class="sp-panel"><div class="sp-panel-header"><span class="sp-panel-title">Forensic Timeline</span></div><div class="sp-timeline-no-data">No suspicious segments</div></div>`;
    return;
  }

  const maxT = Math.max(...suspiciousSegments.map(s => s.endTime)) * 1.15;
  const types = [...new Set(suspiciousSegments.map(s => s.signalType))];
  const W = 380, tH = 18, tG = 6, lW = 65, pt = 22, pb = 18, pr = 10;
  const cW = W - lW - pr, svgH = pt + types.length * (tH + tG) + pb;
  const xS = t => lW + (t / maxT) * cW;

  let ruler = '';
  for (let i = 0; i <= 5; i++) {
    const t = (i / 5) * maxT;
    const x = xS(t);
    const m = Math.floor(t / 60), s = Math.floor(t % 60).toString().padStart(2, '0');
    ruler += `<text x="${x}" y="${pt - 8}" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="8" fill="var(--fs-text-disabled)">${m}:${s}</text>`;
  }

  let tracks = '';
  types.forEach((type, ti) => {
    const y = pt + ti * (tH + tG);
    const color = TRACK_COLORS[type] || '#64748b';
    tracks += `<rect x="${lW}" y="${y}" width="${cW}" height="${tH}" fill="var(--fs-bg-tertiary)" rx="2"/>
               <text x="${lW - 6}" y="${y + tH / 2 + 3}" text-anchor="end" font-family="Inter,sans-serif" font-size="8" font-weight="600" letter-spacing="0.05em" fill="var(--fs-text-tertiary)">${TRACK_LABELS[type] || type}</text>`;
    suspiciousSegments.filter(s => s.signalType === type).forEach(seg => {
      const x1 = xS(seg.startTime), x2 = xS(seg.endTime), w = Math.max(x2 - x1, 3);
      tracks += `<rect x="${x1}" y="${y + 2}" width="${w}" height="${tH - 4}" rx="2" fill="${color}" fill-opacity="${0.3 + seg.severity * 0.5}" style="cursor:pointer"><title>${seg.label}\n${seg.startTime.toFixed(1)}s–${seg.endTime.toFixed(1)}s</title></rect>`;
    });
  });

  el.innerHTML = `<div class="sp-panel"><div class="sp-panel-header"><span class="sp-panel-title">Forensic Timeline</span><span style="font-size:9px;color:var(--fs-text-tertiary)">${suspiciousSegments.length} segment${suspiciousSegments.length !== 1 ? 's' : ''}</span></div>
  <div class="sp-panel-body" style="overflow-x:auto"><svg class="sp-timeline-svg" viewBox="0 0 ${W} ${svgH}">${ruler}${tracks}</svg></div></div>`;
}

// ═══════════════════════════════════════════════════════════════
// CROSS-MODAL CONSISTENCY
// ═══════════════════════════════════════════════════════════════
export function renderCrossModal(result, el) {
  const { crossModalSync, mediaType } = result;
  if (mediaType !== 'video' || !crossModalSync) { el.innerHTML = ''; return; }

  const { syncOffset, isConsistent, description, expectedRanges, observedRanges } = crossModalSync;
  if (isConsistent) {
    el.innerHTML = `<div class="sp-panel"><div class="sp-panel-header"><span class="sp-panel-title">Cross-Modal Consistency</span></div><div class="sp-panel-body" style="text-align:center;color:var(--fs-green);font-weight:600;padding:16px">✓ Sync Consistent</div></div>`;
    return;
  }

  const allT = [...(expectedRanges || []).flatMap(r => [r.start, r.end]), ...(observedRanges || []).flatMap(r => [r.start, r.end])];
  const tMin = Math.min(...allT) - 1, tMax = Math.max(...allT) + 1, tR = tMax - tMin;
  const pct = t => ((t - tMin) / tR * 100).toFixed(1);

  let expBars = (expectedRanges || []).map(r => `<div class="sp-crossmodal-fill expected" style="left:${pct(r.start)}%;width:${pct(r.end) - pct(r.start)}%"></div>`).join('');
  let obsBars = (observedRanges || []).map(r => `<div class="sp-crossmodal-fill observed" style="left:${pct(r.start)}%;width:${pct(r.end) - pct(r.start)}%"></div>`).join('');

  el.innerHTML = `
    <div class="sp-panel"><div class="sp-panel-header"><span class="sp-panel-title">Cross-Modal Consistency</span></div>
    <div class="sp-panel-body">
      <div class="sp-crossmodal-row"><span class="sp-crossmodal-label">Expected</span><div class="sp-crossmodal-track">${expBars}</div></div>
      <div class="sp-crossmodal-row"><span class="sp-crossmodal-label">Observed</span><div class="sp-crossmodal-track">${obsBars}</div></div>
      <div class="sp-crossmodal-offset">
        <span style="font-size:9px;color:var(--fs-text-tertiary);letter-spacing:0.06em;text-transform:uppercase">Sync Offset</span>
        <span style="font-family:var(--fs-font-mono);font-size:var(--fs-text-lg);font-weight:700;color:var(--fs-red)">${syncOffset > 0 ? '+' : ''}${syncOffset != null ? syncOffset.toFixed(2) : '—'} sec</span>
      </div>
      ${description ? `<div class="sp-crossmodal-desc">${description}</div>` : ''}
    </div></div>`;
}

// ═══════════════════════════════════════════════════════════════
// ADAPTIVE ROUTING
// ═══════════════════════════════════════════════════════════════
export function renderRouting(result, el) {
  const { mediaType, contentDetected, activatedModules, skippedModules } = result;
  const activeHtml = (activatedModules || []).map(m => `<div class="sp-routing-module active"><span class="sp-routing-icon">✓</span><span>${m}</span></div>`).join('');
  const skippedHtml = (skippedModules || []).map(m => `<div class="sp-routing-module skipped"><span class="sp-routing-icon">○</span><span>${m}</span></div>`).join('');

  el.innerHTML = `
    <div class="sp-panel sp-expandable" id="sp-routing">
      <div class="sp-panel-header"><span class="sp-panel-title">Why These Tests?</span><span class="sp-toggle">▼</span></div>
      <div class="sp-expandable-content"><div class="sp-panel-body">
        <div class="sp-routing-info">
          <div><div class="sp-routing-label">Media Type</div><div class="sp-routing-value">${(mediaType || 'Unknown').toUpperCase()}</div></div>
          <div><div class="sp-routing-label">Content</div><div class="sp-routing-value">${contentDetected || 'Unknown'}</div></div>
        </div>
        <div style="margin-top:8px"><div style="font-size:9px;color:var(--fs-text-tertiary);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:4px">Activated</div>${activeHtml}</div>
        ${skippedHtml ? `<div style="margin-top:8px"><div style="font-size:9px;color:var(--fs-text-tertiary);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:4px">Not Applicable</div>${skippedHtml}</div>` : ''}
      </div></div>
    </div>`;

  el.querySelector('.sp-panel-header').addEventListener('click', () => el.querySelector('#sp-routing').classList.toggle('open'));
}

// ═══════════════════════════════════════════════════════════════
// CASE SUMMARY
// ═══════════════════════════════════════════════════════════════
export function renderCaseSummary(result, el) {
  const { mediaHash, mediaType, analysisTimeMs, activatedModules, signals, verdictLabel, verdictStatus, stabilityResults } = result;
  const active = (signals || []).filter(s => s.activated);
  const sup = active.filter(s => s.direction === 'supporting').length;
  const con = active.filter(s => s.direction === 'contradicting').length;
  const nonOrig = (stabilityResults || []).filter(r => r.transformation !== 'original' && r.score != null);
  const stab = nonOrig.length ? Math.round(nonOrig.reduce((s, r) => s + r.score, 0) / nonOrig.length) : null;
  const hashDisp = mediaHash ? `${mediaHash.substring(0, 8)}…${mediaHash.slice(-4)}` : '—';
  const time = analysisTimeMs != null ? `${(analysisTimeMs / 1000).toFixed(1)}s` : '—';
  const vc = verdictColor(verdictStatus);

  el.innerHTML = `
    <div class="sp-panel"><div class="sp-panel-header"><span class="sp-panel-title">Case Summary</span></div>
    <div class="sp-panel-body"><div class="sp-case-grid">
      <div class="sp-case-item"><div class="sp-case-item-label">SHA-256</div><div class="sp-case-item-value" style="font-size:10px;color:var(--fs-text-secondary)" title="${mediaHash || ''}">${hashDisp}</div></div>
      <div class="sp-case-item"><div class="sp-case-item-label">Type</div><div class="sp-case-item-value">${(mediaType || '—').toUpperCase()}</div></div>
      <div class="sp-case-item"><div class="sp-case-item-label">Analysis</div><div class="sp-case-item-value">${time}</div></div>
      <div class="sp-case-item"><div class="sp-case-item-label">Modules</div><div class="sp-case-item-value">${activatedModules ? activatedModules.length : 0}</div></div>
      <div class="sp-case-item"><div class="sp-case-item-label">Supporting</div><div class="sp-case-item-value" style="color:var(--fs-red)">${sup}</div></div>
      <div class="sp-case-item"><div class="sp-case-item-label">Contradicting</div><div class="sp-case-item-value" style="color:var(--fs-green)">${con}</div></div>
      <div class="sp-case-item"><div class="sp-case-item-label">Stability</div><div class="sp-case-item-value">${stab != null ? stab + '%' : '—'}</div></div>
      <div class="sp-case-item"><div class="sp-case-item-label">Verdict</div><div class="sp-case-item-value" style="color:${vc}">${verdictLabel || '—'}</div></div>
    </div></div></div>`;
}

// ═══════════════════════════════════════════════════════════════
// MEDIA VIEWER (HEATMAP)
// ═══════════════════════════════════════════════════════════════
export function renderViewer(result, el) {
  const { suspiciousRegions, fileName } = result;
  const hasRegions = suspiciousRegions && suspiciousRegions.length > 0;
  const regionsHtml = hasRegions ? suspiciousRegions.map((r, i) =>
    `<div class="sp-heatmap-region" style="left:${r.x * 100}%;top:${r.y * 100}%;width:${r.width * 100}%;height:${r.height * 100}%;opacity:${0.4 + r.intensity * 0.5}" title="Region ${i + 1}"></div>`
  ).join('') : '<div class="sp-heatmap-unavailable">Localization unavailable</div>';

  el.innerHTML = `
    <div class="sp-panel">
      <div class="sp-viewer-controls">
        <button class="sp-viewer-btn active" data-view="original">Original</button>
        <button class="sp-viewer-btn" data-view="evidence">Evidence</button>
        <button class="sp-viewer-btn" data-view="heatmap">Heatmap</button>
        <span style="flex:1"></span>
        <span style="font-size:9px;color:var(--fs-text-tertiary);align-self:center">${fileName || ''}</span>
      </div>
      <div class="sp-viewer-canvas">
        <div class="sp-viewer-placeholder"><div style="font-size:var(--fs-text-lg);opacity:0.3;margin-bottom:4px">◎</div>Media preview<div style="font-size:9px;margin-top:2px;color:var(--fs-text-disabled)">${(result.mediaType || 'MEDIA').toUpperCase()}</div></div>
        <div class="sp-heatmap-overlay" id="sp-heatmap" style="display:none">${regionsHtml}</div>
      </div>
    </div>`;

  const btns = el.querySelectorAll('.sp-viewer-btn');
  const heatmap = el.querySelector('#sp-heatmap');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      heatmap.style.display = btn.dataset.view === 'original' ? 'none' : 'block';
    });
  });
}
