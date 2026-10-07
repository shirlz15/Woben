/**
 * FORENSIGHT — Side Panel Application (Phase 2 & Phase 3)
 * 
 * Real-Time Browser Media Forensics & Multimodal Analysis:
 * - Real-time processing states: CAPTURING -> ANALYZING -> EVIDENCE READY -> REASONING -> VERDICT
 * - Explainable Image & Video Forensic Reports with Claude Reasoning
 * - Actual EvidenceBundle metrics (Noise stddev, quadrant ratio, blockiness, entropy, edges)
 * - Video Timeline with actual sampled timestamps
 * - Handling of FORENSIC ENGINE UNAVAILABLE, FORENSIC REASONING UNAVAILABLE, and RESTRICTED
 * - ZERO fake scores or fabricated demo verdicts in live mode
 */

const app = document.getElementById('app');

// ─── Local State ────────────────────────────────────────────────
let currentTabId = null;
let currentTabState = {
  inventory: [],
  counts: { images: 0, videos: 0, audio: 0, total: 0 },
  selectedMediaId: null,
  selectedMedia: null,
  status: 'idle',
  analysisResult: null,
};

// ─── Initialization ─────────────────────────────────────────────
async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      currentTabId = tab.id;
      loadTabState(currentTabId);
    } else {
      renderNoTabState();
    }
  } catch (err) {
    console.warn('FORENSIGHT Side Panel init error:', err);
    renderNoTabState();
  }
}

async function loadTabState(tabId) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'GET_TAB_STATE',
      tabId,
    });
    if (response) {
      currentTabState = response;
      renderMainView();
    } else {
      renderMainView();
    }
  } catch (e) {
    renderMainView();
  }
}

// ─── Runtime Message Listener ───────────────────────────────────
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'TAB_STATE_CHANGED' && message.tabId === currentTabId) {
    currentTabState = message.state;
    renderMainView();
  } else if (message.action === 'ACTIVE_TAB_CHANGED') {
    currentTabId = message.tabId;
    loadTabState(currentTabId);
  } else if (message.action === 'TAB_STATE_CLEARED' && message.tabId === currentTabId) {
    currentTabState = message.state;
    renderMainView();
  }
});

// ─── Main View Renderer ─────────────────────────────────────────
function renderMainView() {
  const counts = currentTabState?.counts || { images: 0, videos: 0, audio: 0, total: 0 };
  const inventory = currentTabState?.inventory || [];
  const selected = currentTabState?.selectedMedia;
  const selectedId = currentTabState?.selectedMediaId;
  const status = currentTabState?.status || 'idle';
  const result = currentTabState?.analysisResult;

  app.innerHTML = `
    <!-- Top Header -->
    <div class="sp-header">
      <div class="sp-logo">FOREN<span class="accent">SIGHT</span></div>
      <div class="sp-subtitle">Adaptive Multimodal Forensics</div>
    </div>

    <!-- Sync Status Bar -->
    <div class="sp-sync-bar">
      <div class="sp-sync-indicator">
        <span class="sp-sync-dot"></span>
        <span>Active Tab Synchronized</span>
      </div>
      <button class="sp-rescan-btn-mini" id="rescan-btn">↻ Rescan Tab</button>
    </div>

    <div class="sp-content" style="padding: 12px;">
      <!-- Section 1: Selected Media Forensic Investigation Case -->
      ${renderSelectedMediaSection(selected, status, result)}

      <!-- Section 2: Tab-Level Media Inventory -->
      ${renderInventorySection(counts, inventory, selectedId)}
    </div>
  `;

  attachEventHandlers();
}

// ─── Selected Media Component ───────────────────────────────────
function renderSelectedMediaSection(media, status, result) {
  if (!media) {
    return `
      <div class="sp-empty-selection">
        <div class="sp-empty-icon">◎</div>
        <div class="sp-empty-title">No Media Selected</div>
        <div class="sp-empty-desc">
          Click an image or play a video on the webpage to inspect it here in real time.
        </div>
      </div>
    `;
  }

  const modality = (media.modality || 'media').toLowerCase();
  const modalityLabel = modality.toUpperCase();
  const isRestricted = media.isRestricted || status === 'restricted';

  // In-Progress States
  if (['capturing', 'analyzing', 'evidence_ready', 'reasoning'].includes(status)) {
    return renderProcessingStateCard(media, modalityLabel, status);
  }

  // Engine Unavailable State
  if (status === 'engine_unavailable' || (result && result.error === 'FORENSIC ENGINE UNAVAILABLE')) {
    return renderEngineUnavailableCard(media, modalityLabel);
  }

  // Completed Forensic Verdict
  if (status === 'verdict' && result) {
    return renderVerdictReportCard(media, modalityLabel, result);
  }

  // Restricted Access State
  if (isRestricted) {
    return renderRestrictedCard(media, modalityLabel);
  }

  // Default: Ready for Analysis
  return renderReadyCard(media, modalityLabel);
}

// ─── In-Progress State Card ─────────────────────────────────────
function renderProcessingStateCard(media, modalityLabel, status) {
  let stageLabel = 'PROCESSING';
  let stageDesc = 'Acquiring media data...';
  let progressWidth = '25%';

  if (status === 'capturing') {
    stageLabel = `${modalityLabel} CAPTURING...`;
    stageDesc = 'Extracting pixel container and headers';
    progressWidth = '30%';
  } else if (status === 'analyzing') {
    stageLabel = `${modalityLabel} ANALYZING...`;
    stageDesc = modalityLabel === 'VIDEO' ? 'Sampling keyframes and computing temporal differences' : 'Calculating residual noise, 8x8 blockiness & entropy';
    progressWidth = '60%';
  } else if (status === 'evidence_ready') {
    stageLabel = 'EVIDENCE READY';
    stageDesc = 'Compiling empirical EvidenceBundle';
    progressWidth = '80%';
  } else if (status === 'reasoning') {
    stageLabel = 'REASONING...';
    stageDesc = 'Executing forensic reasoning & consistency check';
    progressWidth = '92%';
  }

  return `
    <div class="sp-panel" style="margin-bottom: 12px;">
      <div class="sp-panel-header">
        <span class="sp-panel-title">Active Case</span>
        <span class="sp-modality-pill ${modalityLabel.toLowerCase()}">${modalityLabel}</span>
      </div>
      <div class="sp-selected-card" style="margin: 0; border: none;">
        <div class="sp-selected-body" style="text-align: center; padding: 20px 14px;">
          <div style="font-size: 11px; font-weight: 600; color: var(--fs-text-primary); margin-bottom: 8px;">
            ${escapeHtml(media.filename || 'media')}
          </div>
          <div style="font-family: var(--fs-font-mono); font-size: 11px; font-weight: 700; color: var(--fs-accent); margin-bottom: 4px;">
            ● ${stageLabel}
          </div>
          <div style="font-size: 10px; color: var(--fs-text-tertiary); margin-bottom: 12px;">
            ${stageDesc}
          </div>
          <div class="sp-progress-bar" style="height: 4px; background: rgba(59, 130, 246, 0.15); border-radius: 2px; overflow: hidden; margin: 0 auto; max-width: 220px;">
            <div style="width: ${progressWidth}; height: 100%; background: var(--fs-accent); transition: width 0.3s ease;"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── Completed Verdict Report Card ──────────────────────────────
function renderVerdictReportCard(media, modalityLabel, result) {
  const verdict = result.verdict || 'INCONCLUSIVE';
  const confidence = typeof result.confidence === 'number' ? Math.round(result.confidence * 100) : 50;
  const isReasoningUnavailable = result.reasoningStatus === 'FORENSIC_REASONING_UNAVAILABLE';

  let statusClass = 'inconclusive';
  let verdictTitle = 'INCONCLUSIVE';
  let badgeColor = 'var(--fs-amber)';

  if (verdict === 'AUTHENTICITY_LIKELY') {
    statusClass = 'authentic';
    verdictTitle = 'AUTHENTICITY LIKELY';
    badgeColor = 'var(--fs-green)';
  } else if (verdict === 'MANIPULATION_LIKELY') {
    statusClass = 'manipulated';
    verdictTitle = 'MANIPULATION LIKELY';
    badgeColor = 'var(--fs-red)';
  }

  const bundle = result.evidenceBundle || {};
  const signals = bundle.signals || {};
  const stats = signals.statistics || {};
  const noise = signals.noise || {};
  const compression = signals.compression || {};
  const edges = signals.edges || {};

  const strongestEvidenceHtml = (result.strongest_evidence || []).map((ev) => `
    <li style="margin-bottom: 4px; color: var(--fs-text-primary);">${escapeHtml(ev)}</li>
  `).join('');

  const contradictoryEvidenceHtml = (result.contradictory_evidence || []).map((ev) => `
    <li style="margin-bottom: 4px; color: var(--fs-text-secondary);">${escapeHtml(ev)}</li>
  `).join('');

  const limitationsHtml = (result.limitations || []).map((lim) => `
    <li style="margin-bottom: 3px; color: var(--fs-text-tertiary); font-size: 9px;">${escapeHtml(lim)}</li>
  `).join('');

  // Video Timeline Component if Video
  let videoTimelineHtml = '';
  if (modalityLabel === 'VIDEO') {
    const sampling = bundle.sampling || {};
    const timestamps = sampling.timestamps || [];
    const frameEvidence = bundle.frameEvidence || [];

    if (timestamps.length > 0) {
      const markersHtml = timestamps.map((ts, idx) => {
        const frame = frameEvidence[idx] || {};
        const isAnomaly = frame.status === 'anomalous';
        const icon = isAnomaly ? '⚠' : '✓';
        const color = isAnomaly ? 'var(--fs-red)' : 'var(--fs-green)';
        return `
          <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
            <span style="font-size: 11px; color: ${color}; font-weight: 700;">${icon}</span>
            <span style="font-family: var(--fs-font-mono); font-size: 8px; color: var(--fs-text-tertiary);">${ts}s</span>
          </div>
        `;
      }).join('');

      videoTimelineHtml = `
        <div style="background: var(--fs-bg-primary); border: 1px solid var(--fs-border-subtle); border-radius: var(--fs-radius-sm); padding: 8px 10px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; font-size: 9px; font-weight: 600; text-transform: uppercase; color: var(--fs-text-tertiary); margin-bottom: 6px;">
            <span>Sampled Keyframe Timeline</span>
            <span style="color: var(--fs-accent);">${timestamps.length} frames</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--fs-border-subtle); padding-top: 6px;">
            ${markersHtml}
          </div>
        </div>
      `;
    }
  }

  return `
    <div class="sp-panel" style="margin-bottom: 12px;">
      <div class="sp-panel-header" style="padding: 8px 12px;">
        <span class="sp-panel-title">Forensic Case Dossier</span>
        <span class="sp-modality-pill ${modalityLabel.toLowerCase()}">${modalityLabel}</span>
      </div>

      <div class="sp-selected-card" style="margin: 0; border: none;">
        <div class="sp-selected-body">
          <div class="sp-selected-filename">${escapeHtml(media.filename || 'media')}</div>

          <!-- Reasoner Status Pill -->
          ${isReasoningUnavailable ? `
            <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); color: #fde68a; font-size: 9px; padding: 4px 8px; border-radius: 4px; margin-bottom: 8px;">
              ⚠ FORENSIC REASONING UNAVAILABLE (Claude unconfigured). Empirical measurements & deterministic baseline displayed below.
            </div>
          ` : `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 9px; color: var(--fs-text-tertiary);">
              <span>REASONING: ${escapeHtml(result.reasoningSource || 'CLAUDE')}</span>
              <span>CONFIDENCE: <strong style="color: ${badgeColor}; font-size: 11px;">${confidence}%</strong></span>
            </div>
          `}

          <!-- Main Verdict Box -->
          <div style="background: rgba(17, 21, 32, 0.85); border: 1px solid ${badgeColor}; border-radius: var(--fs-radius-sm); padding: 10px 12px; margin-bottom: 12px; text-align: center;">
            <div style="font-size: 8px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fs-text-tertiary);">
              Forensic Determination
            </div>
            <div style="font-family: var(--fs-font-mono); font-size: 14px; font-weight: 800; color: ${badgeColor}; margin-top: 2px;">
              ${verdictTitle}
            </div>
            <div style="font-size: 11px; color: var(--fs-text-secondary); margin-top: 6px; line-height: 1.4; text-align: left;">
              ${escapeHtml(result.explanation || '')}
            </div>
          </div>

          <!-- Video Timeline if Video -->
          ${videoTimelineHtml}

          <!-- Evidence Lists -->
          ${strongestEvidenceHtml ? `
            <div style="margin-bottom: 8px;">
              <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: var(--fs-accent); letter-spacing: 0.04em; margin-bottom: 4px;">
                Strongest Evidence
              </div>
              <ul style="font-size: 10px; line-height: 1.4; padding-left: 14px; margin: 0;">
                ${strongestEvidenceHtml}
              </ul>
            </div>
          ` : ''}

          ${contradictoryEvidenceHtml ? `
            <div style="margin-bottom: 8px;">
              <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: var(--fs-text-secondary); letter-spacing: 0.04em; margin-bottom: 4px;">
                Consistent Characteristics
              </div>
              <ul style="font-size: 10px; line-height: 1.4; padding-left: 14px; margin: 0;">
                ${contradictoryEvidenceHtml}
              </ul>
            </div>
          ` : ''}

          <!-- Measured EvidenceBundle Table -->
          <div style="margin-bottom: 10px;">
            <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: var(--fs-text-tertiary); letter-spacing: 0.04em; margin-bottom: 4px;">
              Measured Signals (EvidenceBundle)
            </div>
            <div class="sp-specs-grid">
              <div class="sp-spec-row">
                <span class="sp-spec-key">Noise StdDev (σ)</span>
                <span class="sp-spec-val highlight">${noise.residualStdDev != null ? noise.residualStdDev : '—'}</span>
              </div>
              <div class="sp-spec-row">
                <span class="sp-spec-key">Quadrant Noise Ratio</span>
                <span class="sp-spec-val">${noise.quadrantVarianceRatio != null ? noise.quadrantVarianceRatio : '—'}</span>
              </div>
              <div class="sp-spec-row">
                <span class="sp-spec-key">Shannon Entropy</span>
                <span class="sp-spec-val">${stats.shannonEntropy != null ? `${stats.shannonEntropy} b/px` : '—'}</span>
              </div>
              <div class="sp-spec-row">
                <span class="sp-spec-key">Blockiness Discontinuity</span>
                <span class="sp-spec-val">${compression.blockinessScore != null ? compression.blockinessScore : '—'}</span>
              </div>
              <div class="sp-spec-row">
                <span class="sp-spec-key">Mean Edge Gradient</span>
                <span class="sp-spec-val">${edges.meanGradient != null ? edges.meanGradient : '—'}</span>
              </div>
              <div class="sp-spec-row">
                <span class="sp-spec-key">Edge Density</span>
                <span class="sp-spec-val">${edges.edgeDensity != null ? `${(edges.edgeDensity * 100).toFixed(1)}%` : '—'}</span>
              </div>
            </div>
          </div>

          <!-- Limitations -->
          ${limitationsHtml ? `
            <div style="margin-bottom: 10px; padding: 6px 8px; background: rgba(0,0,0,0.2); border-radius: var(--fs-radius-sm);">
              <div style="font-size: 8px; font-weight: 700; text-transform: uppercase; color: var(--fs-text-tertiary); margin-bottom: 3px;">
                Analytical Limitations
              </div>
              <ul style="padding-left: 12px; margin: 0;">
                ${limitationsHtml}
              </ul>
            </div>
          ` : ''}

          <!-- Recommended Action -->
          ${result.recommended_action ? `
            <div style="font-size: 10px; color: var(--fs-text-secondary); margin-bottom: 12px; font-style: italic;">
              <strong>Guidance:</strong> ${escapeHtml(result.recommended_action)}
            </div>
          ` : ''}

          <!-- Action Buttons -->
          <div class="sp-action-row">
            <button class="sp-locate-btn" id="locate-btn" data-media-id="${media.mediaId}">
              <span>⌖</span> Locate in Page
            </button>
            <button class="sp-deselect-btn" id="deselect-btn">✕ Clear</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── Engine Unavailable Card ────────────────────────────────────
function renderEngineUnavailableCard(media, modalityLabel) {
  return `
    <div class="sp-panel" style="margin-bottom: 12px;">
      <div class="sp-panel-header">
        <span class="sp-panel-title">Selected Media</span>
        <span class="sp-modality-pill ${modalityLabel.toLowerCase()}">${modalityLabel}</span>
      </div>
      <div class="sp-selected-card" style="margin: 0; border: none;">
        <div class="sp-selected-body">
          <div class="sp-selected-filename">${escapeHtml(media.filename || 'media')}</div>
          <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: var(--fs-radius-sm); padding: 10px 12px; margin-bottom: 12px;">
            <div style="font-family: var(--fs-font-mono); font-size: 11px; font-weight: 700; color: var(--fs-red);">
              ● FORENSIC ENGINE UNAVAILABLE
            </div>
            <div style="font-size: 10px; color: var(--fs-text-secondary); margin-top: 4px; line-height: 1.4;">
              Could not connect to the forensic backend at <code>http://localhost:8000</code>.
              Please start the server with <code>npm run backend</code>.
            </div>
          </div>
          <div class="sp-action-row">
            <button class="sp-locate-btn" id="locate-btn" data-media-id="${media.mediaId}">⌖ Locate</button>
            <button class="sp-deselect-btn" id="deselect-btn">✕ Clear</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── Restricted Card ────────────────────────────────────────────
function renderRestrictedCard(media, modalityLabel) {
  return `
    <div class="sp-panel" style="margin-bottom: 12px;">
      <div class="sp-panel-header">
        <span class="sp-panel-title">Selected Media</span>
        <span class="sp-modality-pill ${modalityLabel.toLowerCase()}">${modalityLabel}</span>
      </div>
      <div class="sp-selected-card" style="margin: 0; border: none;">
        <div class="sp-selected-body">
          <div class="sp-selected-filename">${escapeHtml(media.filename || 'media')}</div>
          <div class="sp-status-banner restricted">
            <span class="sp-status-icon">⚠</span>
            <span>MEDIA ACCESS RESTRICTED</span>
          </div>
          <div style="font-size: 10px; color: var(--fs-text-tertiary); margin-bottom: 12px; line-height: 1.4;">
            Browser security policies (CORS or DRM protection) prevent pixel container extraction for this media element.
          </div>
          <div class="sp-action-row">
            <button class="sp-locate-btn" id="locate-btn" data-media-id="${media.mediaId}">⌖ Locate</button>
            <button class="sp-deselect-btn" id="deselect-btn">✕ Clear</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── Ready Card ─────────────────────────────────────────────────
function renderReadyCard(media, modalityLabel) {
  return `
    <div class="sp-panel" style="margin-bottom: 12px;">
      <div class="sp-panel-header">
        <span class="sp-panel-title">Selected Media</span>
        <span class="sp-modality-pill ${modalityLabel.toLowerCase()}">${modalityLabel}</span>
      </div>
      <div class="sp-selected-card" style="margin: 0; border: none;">
        <div class="sp-selected-body">
          <div class="sp-selected-filename">${escapeHtml(media.filename || 'media')}</div>
          <div class="sp-status-banner ready">
            <span class="sp-status-icon">●</span>
            <span>READY FOR FORENSIC ANALYSIS</span>
          </div>
          <div class="sp-action-row">
            <button class="sp-locate-btn" id="locate-btn" data-media-id="${media.mediaId}">⌖ Locate</button>
            <button class="sp-deselect-btn" id="deselect-btn">✕ Clear</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── Inventory Section Component ────────────────────────────────
function renderInventorySection(counts, inventory, selectedMediaId) {
  const itemsHtml = inventory.length > 0
    ? inventory.map((item, idx) => {
        const isSelected = item.mediaId === selectedMediaId;
        const modality = (item.modality || 'media').toLowerCase();
        const icon = modality === 'video' ? '🎬' : modality === 'audio' ? '🎙️' : '🖼️';
        const dimsOrDur = modality === 'video' || modality === 'audio'
          ? (item.duration ? `${item.duration.toFixed(1)}s` : `${item.width || 0}×${item.height || 0}`)
          : `${item.width || 0}×${item.height || 0}`;

        const stateLabel = isSelected
          ? 'SELECTED'
          : item.isRestricted
          ? 'RESTRICTED'
          : 'READY';
        const stateClass = isSelected
          ? 'selected'
          : item.isRestricted
          ? 'restricted'
          : 'ready';

        return `
          <div class="sp-live-media-item ${isSelected ? 'active' : ''}" data-media-id="${item.mediaId}">
            <div class="sp-media-icon-badge">${icon}</div>
            <div class="sp-media-item-info">
              <div class="sp-media-item-name">${escapeHtml(item.filename || `Item #${idx + 1}`)}</div>
              <div class="sp-media-item-sub">#${String(idx + 1).padStart(2, '0')} · ${modality.toUpperCase()} · ${dimsOrDur}</div>
            </div>
            <span class="sp-item-state-pill ${stateClass}">${stateLabel}</span>
          </div>
        `;
      }).join('')
    : `<div style="text-align: center; color: var(--fs-text-disabled); font-size: 11px; padding: 24px 0;">No media detected on this page yet.</div>`;

  return `
    <div class="sp-panel">
      <div class="sp-panel-header">
        <span class="sp-panel-title">Media Inventory</span>
        <span style="font-family: var(--fs-font-mono); font-size: 9px; color: var(--fs-accent);">${counts.total} items</span>
      </div>
      <div class="sp-panel-body">
        <!-- Counters Grid -->
        <div class="sp-inventory-counters">
          <div class="sp-counter-box">
            <div class="sp-counter-num">${counts.images || 0}</div>
            <div class="sp-counter-label">Images</div>
          </div>
          <div class="sp-counter-box">
            <div class="sp-counter-num">${counts.videos || 0}</div>
            <div class="sp-counter-label">Videos</div>
          </div>
          <div class="sp-counter-box">
            <div class="sp-counter-num">${counts.audio || 0}</div>
            <div class="sp-counter-label">Audio</div>
          </div>
          <div class="sp-counter-box total">
            <div class="sp-counter-num">${counts.total || 0}</div>
            <div class="sp-counter-label">Total</div>
          </div>
        </div>

        <div class="sp-active-pill">
          <span>Active Case:</span>
          <strong>${selectedMediaId || 'None (select below or interact on page)'}</strong>
        </div>

        <div class="sp-live-media-list">
          ${itemsHtml}
        </div>
      </div>
    </div>
  `;
}

// ─── Event Handlers ─────────────────────────────────────────────
function attachEventHandlers() {
  document.getElementById('rescan-btn')?.addEventListener('click', async () => {
    if (!currentTabId) return;
    try {
      await chrome.runtime.sendMessage({ action: 'SCAN_TAB', tabId: currentTabId });
    } catch (e) {}
  });

  document.getElementById('locate-btn')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const mediaId = btn.dataset.mediaId;
    if (mediaId && currentTabId) {
      chrome.runtime.sendMessage({ action: 'HIGHLIGHT_MEDIA', tabId: currentTabId, mediaId }).catch(() => {});
    }
  });

  document.getElementById('deselect-btn')?.addEventListener('click', () => {
    if (currentTabId) {
      chrome.runtime.sendMessage({ action: 'CLEAR_SELECTION', tabId: currentTabId }).catch(() => {});
    }
  });

  document.querySelectorAll('.sp-live-media-item').forEach((itemEl) => {
    itemEl.addEventListener('click', () => {
      const mediaId = itemEl.dataset.mediaId;
      if (mediaId && currentTabId) {
        chrome.runtime.sendMessage({ action: 'SELECT_MEDIA_FROM_PANEL', tabId: currentTabId, mediaId }).catch(() => {});
      }
    });
  });
}

function renderNoTabState() {
  app.innerHTML = `
    <div class="sp-header">
      <div class="sp-logo">FOREN<span class="accent">SIGHT</span></div>
      <div class="sp-subtitle">Digital Media Forensics</div>
    </div>
    <div class="sp-content" style="padding: 24px; text-align: center;">
      <div style="color: var(--fs-text-tertiary); font-size: var(--fs-text-sm);">
        Open a webpage to inspect images, videos, and audio.
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── Start ──────────────────────────────────────────────────────
init();
