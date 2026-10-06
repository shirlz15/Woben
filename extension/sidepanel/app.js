/**
 * FORENSIGHT — Side Panel Application
 * 
 * Manages views: idle → scanning → summary → individual report.
 * Responds to interaction-based analysis (image click, video/audio play).
 */

import {
  renderVerdict, renderConstellation, renderSignals, renderMatrix,
  renderExplanation, renderStability, renderFlow, renderTimeline,
  renderCrossModal, renderRouting, renderCaseSummary, renderViewer,
} from './components.js';

import {
  downloadJSON, downloadTabJSON, downloadPDF, downloadTabPDF,
} from './report-generator.js';

const app = document.getElementById('app');

// ─── State ──────────────────────────────────────────────────────
let currentView = 'idle';
let currentState = null;
let currentTabId = null;
let selectedMediaId = null;

// ─── Scan Stages ────────────────────────────────────────────────
const SCAN_STAGES = [
  { id: 'scanning_tab', label: 'Scanning Tab' },
  { id: 'detecting_media', label: 'Detecting Media' },
  { id: 'media_detected', label: 'Identifying Modality' },
  { id: 'analyzing_media', label: 'Collecting Evidence' },
  { id: 'checking_contradictions', label: 'Checking Contradictions' },
  { id: 'testing_stability', label: 'Testing Stability' },
  { id: 'complete', label: 'Building Report' },
];

// ─── Init ───────────────────────────────────────────────────────
async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      currentTabId = tab.id;
      const response = await chrome.runtime.sendMessage({ action: 'getState', tabId: currentTabId });
      if (response && response.status && response.status !== 'idle') {
        currentState = response;
        if (response.selectedMediaId && response.results?.[response.selectedMediaId]) {
          selectedMediaId = response.selectedMediaId;
          renderReportView(selectedMediaId);
        } else if (response.status === 'complete') {
          renderSummaryView();
        } else if (response.status === 'scanning' || response.status === 'analyzing') {
          if (response.selectedMediaId) {
            renderAnalyzingMediaView(response.selectedMediaId);
          } else {
            renderScanningView();
          }
        } else {
          renderIdleView();
        }
      } else {
        renderIdleView();
      }
    } else {
      renderIdleView();
    }
  } catch (e) {
    renderIdleView();
  }
}

// ─── Message Listener ───────────────────────────────────────────
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'stateUpdate' && message.tabId === currentTabId) {
    currentState = message.state;
    onStateChange();
  }
  if (message.action === 'focusMedia' && message.mediaId) {
    selectedMediaId = message.mediaId;
    if (currentState?.results?.[message.mediaId]) {
      renderReportView(message.mediaId);
    }
  }
});

function onStateChange() {
  if (!currentState) return;

  // If a specific media was selected (interaction-based)
  if (currentState.selectedMediaId) {
    selectedMediaId = currentState.selectedMediaId;

    if (currentState.status === 'analyzing') {
      renderAnalyzingMediaView(selectedMediaId);
      return;
    }

    if (currentState.status === 'complete' && currentState.results?.[selectedMediaId]) {
      renderReportView(selectedMediaId);
      return;
    }
  }

  // Tab-level scanning
  switch (currentState.status) {
    case 'scanning':
    case 'analyzing':
      if (currentView !== 'report') renderScanningView();
      break;
    case 'complete':
      if (currentView !== 'report') {
        if (Object.keys(currentState.results || {}).length === 1) {
          const onlyId = Object.keys(currentState.results)[0];
          renderReportView(onlyId);
        } else {
          renderSummaryView();
        }
      }
      break;
    case 'error':
      renderErrorView(currentState.error);
      break;
  }
}

// ═══════════════════════════════════════════════════════════════
// IDLE VIEW
// ═══════════════════════════════════════════════════════════════
function renderIdleView() {
  currentView = 'idle';
  app.innerHTML = `
    <div class="sp-header">
      <div class="sp-logo">FOREN<span class="accent">SIGHT</span></div>
      <div class="sp-subtitle">Verify before you trust.</div>
      <div class="sp-privacy"><span class="sp-privacy-dot"></span> Local Forensic Analysis</div>
    </div>
    <div class="sp-content">
      <button class="sp-scan-btn" id="scan-btn">◎ Scan This Tab</button>
      <div class="sp-idle">
        <div class="sp-idle-icon">◎</div>
        <div class="sp-idle-text">
          <strong>Click</strong> an image, <strong>play</strong> a video or audio to analyze it — or use <strong>Scan This Tab</strong> to analyze all media at once.
        </div>
      </div>
      <div class="sp-panel">
        <div class="sp-panel-header"><span class="sp-panel-title">How It Works</span></div>
        <div class="sp-panel-body" style="display:flex;flex-direction:column;gap:6px;font-size:var(--fs-text-sm);color:var(--fs-text-secondary)">
          <div>Click any image on the page</div>
          <div>Play any video or audio</div>
          <div style="color:var(--fs-accent)">→ FORENSIGHT analyzes it automatically</div>
          <div style="margin-top:4px;color:var(--fs-text-tertiary);font-size:9px;letter-spacing:0.06em">Independent signals · Evidence relationships · Calibrated verdict</div>
        </div>
      </div>
      <div style="text-align:center;font-size:9px;color:var(--fs-text-disabled);letter-spacing:0.08em;text-transform:uppercase;padding:16px 0">
        FORENSIGHT v1.0
      </div>
    </div>
  `;
  document.getElementById('scan-btn').addEventListener('click', startScan);
}

// ═══════════════════════════════════════════════════════════════
// ANALYZING SPECIFIC MEDIA VIEW (interaction-triggered)
// ═══════════════════════════════════════════════════════════════
function renderAnalyzingMediaView(mediaId) {
  currentView = 'analyzing';
  const mediaItem = currentState?.media?.find(m => m.id === mediaId);
  const mediaType = mediaItem?.type || 'media';
  const fileName = mediaItem?.filename || '';

  app.innerHTML = `
    <div class="sp-header">
      <div class="sp-logo">FOREN<span class="accent">SIGHT</span></div>
      <div class="sp-subtitle">Forensic Case</div>
    </div>
    <div class="sp-content">
      <div class="sp-panel">
        <div class="sp-panel-body" style="text-align:center;padding:24px">
          <div style="font-size:var(--fs-text-xs);font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--fs-text-tertiary);margin-bottom:8px">${mediaType.toUpperCase()}</div>
          <div style="font-size:var(--fs-text-sm);color:var(--fs-text-secondary);margin-bottom:16px;word-break:break-all">${fileName}</div>
          <div class="sp-progress-stage">● Analyzing</div>
          <div class="sp-progress-bar" style="margin:12px auto;max-width:200px"><div class="sp-progress-fill" style="width:60%;animation:sp-analyze-progress 2s ease-out forwards"></div></div>
          <div style="display:flex;flex-direction:column;gap:4px;text-align:left;max-width:200px;margin:16px auto 0">
            <div class="sp-progress-step completed"><span class="sp-step-icon">✓</span> Identifying Media</div>
            <div class="sp-progress-step completed"><span class="sp-step-icon">✓</span> Selecting Forensic Modules</div>
            <div class="sp-progress-step active"><span class="sp-step-icon">●</span> Collecting Evidence</div>
            <div class="sp-progress-step"><span class="sp-step-icon">○</span> Checking Consistency</div>
            <div class="sp-progress-step"><span class="sp-step-icon">○</span> Building Verdict</div>
          </div>
        </div>
      </div>
    </div>
    <style>
      @keyframes sp-analyze-progress {
        0% { width: 20%; }
        50% { width: 60%; }
        100% { width: 95%; }
      }
    </style>
  `;
}

// ═══════════════════════════════════════════════════════════════
// SCANNING VIEW (full tab scan)
// ═══════════════════════════════════════════════════════════════
function renderScanningView() {
  currentView = 'scanning';
  const stage = currentState?.stage || 'scanning_tab';
  const activeIdx = SCAN_STAGES.findIndex(s => s.id === stage);
  const progress = Math.max(5, Math.round(((activeIdx + 1) / SCAN_STAGES.length) * 100));
  const analyzed = currentState?.analyzedCount || 0;
  const total = currentState?.totalMedia || 0;

  const stepsHtml = SCAN_STAGES.map((s, i) => {
    const cls = i < activeIdx ? 'completed' : i === activeIdx ? 'active' : '';
    const icon = i < activeIdx ? '✓' : i === activeIdx ? '●' : '○';
    return `<div class="sp-progress-step ${cls}"><span class="sp-step-icon">${icon}</span> ${s.label}</div>`;
  }).join('');

  app.innerHTML = `
    <div class="sp-header">
      <div class="sp-logo">FOREN<span class="accent">SIGHT</span></div>
      <div class="sp-subtitle">Digital Media Forensics</div>
    </div>
    <div class="sp-content">
      <div class="sp-progress">
        <div class="sp-progress-stage">● Scanning Tab</div>
        <div class="sp-progress-bar"><div class="sp-progress-fill" style="width:${progress}%"></div></div>
        <div class="sp-progress-steps">${stepsHtml}</div>
        ${total > 0 ? `<div style="font-size:var(--fs-text-sm);color:var(--fs-text-secondary);margin-top:8px">${analyzed} / ${total} media</div>` : ''}
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// SUMMARY VIEW (Tab-level)
// ═══════════════════════════════════════════════════════════════
function renderSummaryView() {
  currentView = 'summary';
  const state = currentState;
  const media = state?.media || [];
  const results = state?.results || {};
  const analyzed = Object.keys(results).length;
  const unavail = media.length - analyzed;
  const manip = Object.values(results).filter(r => r.verdictStatus === 'manipulated').length;
  const auth = Object.values(results).filter(r => r.verdictStatus === 'authentic').length;
  const inc = Object.values(results).filter(r => r.verdictStatus === 'inconclusive').length;
  const anyDemo = Object.values(results).some(r => r.isDemo);

  const cardsHtml = media.map((m, i) => {
    const r = results[m.id];
    const status = r ? r.verdictStatus : 'pending';
    const label = r ? r.verdictLabel : 'Pending...';
    const score = r?.verdictScore;
    const vc = status === 'manipulated' ? 'var(--fs-red)' : status === 'authentic' ? 'var(--fs-green)' : status === 'inconclusive' ? 'var(--fs-amber)' : 'var(--fs-accent)';
    return `
      <div class="sp-media-card" data-status="${status}" data-media-id="${m.id}">
        <div class="sp-media-card-top">
          <span class="sp-media-card-type">${m.type?.toUpperCase() || '—'}</span>
          <span class="sp-media-card-index">#${String(i + 1).padStart(2, '0')}</span>
        </div>
        <div class="sp-media-card-filename">${m.filename || '—'}</div>
        <div class="sp-media-card-verdict">
          <span class="sp-media-card-status ${status}">${label}</span>
          ${score != null ? `<span class="sp-media-card-score" style="color:${vc}">${score}%</span>` : ''}
        </div>
        <div class="sp-media-card-action">View Forensic Report →</div>
      </div>`;
  }).join('');

  app.innerHTML = `
    <div class="sp-header">
      <div class="sp-logo">FOREN<span class="accent">SIGHT</span></div>
      <div class="sp-subtitle">Digital Media Forensics</div>
      ${anyDemo ? '<div style="margin-top:4px"><span class="sp-demo-badge">DEMO MODE</span></div>' : ''}
    </div>
    <div class="sp-content">
      <div class="sp-panel">
        <div class="sp-panel-header"><span class="sp-panel-title">Tab Summary</span><span style="font-size:9px;color:var(--fs-green);font-weight:600">● SCANNED</span></div>
        <div class="sp-panel-body">
          <div class="sp-tab-stats">
            <div class="sp-stat"><div class="sp-stat-label">Detected</div><div class="sp-stat-value">${media.length}</div></div>
            <div class="sp-stat"><div class="sp-stat-label">Analyzed</div><div class="sp-stat-value">${analyzed}</div></div>
            <div class="sp-stat"><div class="sp-stat-label">Manipulation</div><div class="sp-stat-value red">${manip}</div></div>
            <div class="sp-stat"><div class="sp-stat-label">Authentic</div><div class="sp-stat-value green">${auth}</div></div>
            <div class="sp-stat"><div class="sp-stat-label">Inconclusive</div><div class="sp-stat-value amber">${inc}</div></div>
            <div class="sp-stat"><div class="sp-stat-label">Unavailable</div><div class="sp-stat-value">${unavail}</div></div>
          </div>
          <div style="font-size:9px;color:var(--fs-text-tertiary);margin-top:8px;line-height:1.5">
            Each media item is analyzed independently. Tab summary aggregates individual assessments.
          </div>
        </div>
      </div>

      <div class="sp-panel">
        <div class="sp-panel-header"><span class="sp-panel-title">Media Inventory</span></div>
        <div class="sp-panel-body"><div class="sp-media-list">${cardsHtml}</div></div>
      </div>

      <div class="sp-download-row">
        <button class="sp-download-btn" id="dl-tab-pdf">↓ Tab PDF</button>
        <button class="sp-download-btn" id="dl-tab-json">↓ Tab JSON</button>
      </div>
      <button class="sp-scan-btn" id="rescan-btn" style="background:var(--fs-bg-tertiary);border-color:var(--fs-border-default);color:var(--fs-text-secondary)">↻ Re-scan Tab</button>
    </div>
  `;

  document.querySelectorAll('.sp-media-card').forEach(card => {
    card.addEventListener('click', () => renderReportView(card.dataset.mediaId));
  });
  document.getElementById('dl-tab-pdf')?.addEventListener('click', () => downloadTabPDF(state));
  document.getElementById('dl-tab-json')?.addEventListener('click', () => downloadTabJSON(state, 'forensight-tab'));
  document.getElementById('rescan-btn')?.addEventListener('click', startScan);
}

// ═══════════════════════════════════════════════════════════════
// INDIVIDUAL REPORT VIEW
// ═══════════════════════════════════════════════════════════════
function renderReportView(mediaId) {
  currentView = 'report';
  selectedMediaId = mediaId;

  const result = currentState?.results?.[mediaId];
  if (!result) {
    app.innerHTML = `
      <div class="sp-header"><div class="sp-logo">FOREN<span class="accent">SIGHT</span></div></div>
      <div class="sp-content">
        <button class="sp-back-btn" id="back-btn">← Back</button>
        <div class="sp-error">Analysis result not available for this media item.</div>
      </div>`;
    document.getElementById('back-btn').addEventListener('click', goBack);
    return;
  }

  const isVideo = result.mediaType === 'video';
  const isAudio = result.mediaType === 'audio';
  const hasMultiple = Object.keys(currentState?.results || {}).length > 1;
  const mediaItem = currentState?.media?.find(m => m.id === mediaId);

  // Media preview info
  const previewType = (result.mediaType || 'MEDIA').toUpperCase();
  const duration = mediaItem?.duration ? `${mediaItem.duration.toFixed(1)}s` : '';
  const dims = (mediaItem?.width && mediaItem?.height) ? `${mediaItem.width}×${mediaItem.height}` : '';
  const previewMeta = [previewType, dims, duration].filter(Boolean).join(' · ');

  app.innerHTML = `
    <div class="sp-header">
      <div class="sp-logo">FOREN<span class="accent">SIGHT</span></div>
      <div class="sp-subtitle">Forensic Case</div>
      ${result.isDemo ? '<div style="margin-top:4px"><span class="sp-demo-badge">DEMO DATA</span></div>' : ''}
    </div>
    <div class="sp-content">
      ${hasMultiple ? '<button class="sp-back-btn" id="back-btn">← All Media</button>' : ''}

      <!-- Media Preview -->
      <div class="sp-panel">
        <div class="sp-panel-body" style="text-align:center;padding:12px">
          <div style="font-size:var(--fs-text-xs);font-weight:600;letter-spacing:0.08em;color:var(--fs-text-tertiary)">${previewMeta}</div>
          <div style="font-size:var(--fs-text-sm);color:var(--fs-text-secondary);margin-top:2px;word-break:break-all">${result.fileName || mediaItem?.filename || '—'}</div>
          ${result.id ? `<div style="font-family:var(--fs-font-mono);font-size:9px;color:var(--fs-text-disabled);margin-top:4px">Case ${result.id}</div>` : ''}
        </div>
      </div>

      <div id="slot-verdict"></div>
      <div id="slot-constellation"></div>
      <div id="slot-viewer"></div>
      <div id="slot-signals"></div>
      <div id="slot-matrix"></div>
      <div id="slot-explanation"></div>
      ${isVideo || isAudio ? '<div id="slot-timeline"></div>' : ''}
      ${isVideo ? '<div id="slot-crossmodal"></div>' : ''}
      <div id="slot-stability"></div>
      <div id="slot-flow"></div>
      <div id="slot-routing"></div>
      <div id="slot-case"></div>
      <div class="sp-download-row">
        <button class="sp-download-btn" id="dl-pdf">↓ PDF Report</button>
        <button class="sp-download-btn" id="dl-json">↓ JSON</button>
      </div>
    </div>
  `;

  document.getElementById('back-btn')?.addEventListener('click', goBack);

  renderVerdict(result, document.getElementById('slot-verdict'));
  renderConstellation(result, document.getElementById('slot-constellation'));
  renderViewer(result, document.getElementById('slot-viewer'));
  renderSignals(result, document.getElementById('slot-signals'));
  renderMatrix(result, document.getElementById('slot-matrix'));
  renderExplanation(result, document.getElementById('slot-explanation'));
  if (isVideo || isAudio) renderTimeline(result, document.getElementById('slot-timeline'));
  if (isVideo) renderCrossModal(result, document.getElementById('slot-crossmodal'));
  renderStability(result, document.getElementById('slot-stability'));
  renderFlow(result, document.getElementById('slot-flow'));
  renderRouting(result, document.getElementById('slot-routing'));
  renderCaseSummary(result, document.getElementById('slot-case'));

  document.getElementById('dl-pdf')?.addEventListener('click', () => downloadPDF(result));
  document.getElementById('dl-json')?.addEventListener('click', () => downloadJSON(result, `forensight-${result.id || 'report'}`));

  // Highlight media in page
  try { chrome.tabs.sendMessage(currentTabId, { action: 'highlightMedia', mediaId }); } catch (e) {}

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ═══════════════════════════════════════════════════════════════
// ERROR VIEW
// ═══════════════════════════════════════════════════════════════
function renderErrorView(error) {
  currentView = 'idle';
  app.innerHTML = `
    <div class="sp-header"><div class="sp-logo">FOREN<span class="accent">SIGHT</span></div><div class="sp-subtitle">Digital Media Forensics</div></div>
    <div class="sp-content">
      <div class="sp-panel"><div class="sp-panel-header"><span class="sp-panel-title">Error</span></div>
        <div class="sp-panel-body">
          <div class="sp-error">${error || 'An unexpected error occurred.'}</div>
          <div style="font-size:var(--fs-text-sm);color:var(--fs-text-tertiary);margin-top:8px;text-align:center">
            This may happen if media is protected, the backend is unavailable, or CORS restrictions apply.
          </div>
        </div>
      </div>
      <button class="sp-scan-btn" id="retry-btn">↻ Try Again</button>
    </div>
  `;
  document.getElementById('retry-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'clearState', tabId: currentTabId });
    renderIdleView();
  });
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function goBack() {
  const media = currentState?.media || [];
  const results = currentState?.results || {};
  if (Object.keys(results).length > 1) {
    renderSummaryView();
  } else {
    renderIdleView();
  }
}

async function startScan() {
  if (!currentTabId) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) currentTabId = tab.id;
    } catch (e) {}
  }
  if (!currentTabId) { renderErrorView('Could not identify the active tab.'); return; }

  currentState = { status: 'scanning', stage: 'scanning_tab' };
  renderScanningView();

  try {
    await chrome.runtime.sendMessage({ action: 'scanTab', tabId: currentTabId });
  } catch (e) {
    renderErrorView(e.message || 'Scan failed.');
  }
}

// ─── Start ──────────────────────────────────────────────────────
init();
