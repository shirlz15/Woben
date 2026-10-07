/**
 * FORENSIGHT — Side Panel Application (Phase 1)
 * 
 * Real-Time Browser Media Detection & Exact Media Selection.
 * 
 * Features:
 * 1. Synchronizes live with active tab DOM media inventory
 * 2. Renders the exact selected media item (Image, Video, Audio)
 * 3. Shows accurate real-time status: READY FOR FORENSIC ANALYSIS / ACCESS RESTRICTED
 * 4. Displays real-time tab inventory counts (Images, Videos, Audio, Total)
 * 5. Allows locating media in page and selecting items directly from inventory
 * 6. NO fake scores or fabricated verdicts
 */

const app = document.getElementById('app');

// ─── Local State ────────────────────────────────────────────────
let currentTabId = null;
let currentTabState = {
  inventory: [],
  counts: { images: 0, videos: 0, audio: 0, total: 0 },
  selectedMediaId: null,
  selectedMedia: null,
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

  app.innerHTML = `
    <!-- Top Header -->
    <div class="sp-header">
      <div class="sp-logo">FOREN<span class="accent">SIGHT</span></div>
      <div class="sp-subtitle">Digital Media Forensics</div>
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
      <!-- Section 1: Selected Media Hero Case -->
      ${renderSelectedMediaSection(selected)}

      <!-- Section 2: Tab-Level Media Inventory -->
      ${renderInventorySection(counts, inventory, selectedId)}
    </div>
  `;

  attachEventHandlers();
}

// ─── Selected Media Component ───────────────────────────────────
function renderSelectedMediaSection(media) {
  if (!media) {
    return `
      <div class="sp-empty-selection">
        <div class="sp-empty-icon">◎</div>
        <div class="sp-empty-title">No Media Selected</div>
        <div class="sp-empty-desc">
          Click an image or play a video/audio on the webpage to inspect it here in real time.
        </div>
      </div>
    `;
  }

  const modality = (media.modality || 'media').toLowerCase();
  const modalityLabel = modality.toUpperCase();
  const isRestricted = media.isRestricted;
  const statusClass = isRestricted ? 'restricted' : 'ready';
  const statusText = isRestricted
    ? 'MEDIA ACCESS RESTRICTED'
    : 'READY FOR FORENSIC ANALYSIS';
  const statusIcon = isRestricted ? '⚠' : '●';

  const dims = (media.width && media.height) ? `${media.width} × ${media.height} px` : '—';
  const duration = (media.duration && !isNaN(media.duration) && media.duration > 0)
    ? `${media.duration.toFixed(1)}s`
    : '—';

  let domain = '—';
  if (media.sourceUrl) {
    try {
      domain = new URL(media.sourceUrl, window.location.href).hostname;
    } catch {
      domain = 'local / inline';
    }
  }

  const accessStatus = isRestricted
    ? `Restricted (${media.restrictionReason || 'CORS/Blob'})`
    : 'Direct Access Verified';

  return `
    <div class="sp-panel" style="margin-bottom: 12px;">
      <div class="sp-panel-header" style="padding: 8px 12px;">
        <span class="sp-panel-title">Selected Media</span>
        <span class="sp-modality-pill ${modality}">${modalityLabel}</span>
      </div>

      <div class="sp-selected-card" style="margin: 0; border: none; border-radius: 0;">
        <div class="sp-selected-body">
          <div class="sp-selected-filename">${escapeHtml(media.filename || 'media')}</div>

          <!-- Status Banner -->
          <div class="sp-status-banner ${statusClass}">
            <span class="sp-status-icon">${statusIcon}</span>
            <span>${statusText}</span>
          </div>

          <!-- Technical Specs Grid -->
          <div class="sp-specs-grid">
            <div class="sp-spec-row">
              <span class="sp-spec-key">Modality</span>
              <span class="sp-spec-val highlight">${modalityLabel}</span>
            </div>
            <div class="sp-spec-row">
              <span class="sp-spec-key">Element</span>
              <span class="sp-spec-val">&lt;${media.elementType || modality}&gt;</span>
            </div>
            <div class="sp-spec-row">
              <span class="sp-spec-key">Dimensions</span>
              <span class="sp-spec-val">${dims}</span>
            </div>
            <div class="sp-spec-row">
              <span class="sp-spec-key">Duration</span>
              <span class="sp-spec-val">${duration}</span>
            </div>
            <div class="sp-spec-row">
              <span class="sp-spec-key">Origin Domain</span>
              <span class="sp-spec-val" title="${domain}">${domain}</span>
            </div>
            <div class="sp-spec-row">
              <span class="sp-spec-key">Access</span>
              <span class="sp-spec-val ${isRestricted ? 'highlight' : ''}">${accessStatus}</span>
            </div>
          </div>

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

        <!-- Active Media Indicator -->
        <div class="sp-active-pill">
          <span>Active Case:</span>
          <strong>${selectedMediaId || 'None (select below or click on page)'}</strong>
        </div>

        <!-- Media Items List -->
        <div class="sp-live-media-list">
          ${itemsHtml}
        </div>
      </div>
    </div>
  `;
}

// ─── Event Handlers ─────────────────────────────────────────────
function attachEventHandlers() {
  // Rescan button
  document.getElementById('rescan-btn')?.addEventListener('click', async () => {
    if (!currentTabId) return;
    try {
      await chrome.runtime.sendMessage({
        action: 'SCAN_TAB',
        tabId: currentTabId,
      });
    } catch (e) {}
  });

  // Locate in Page button
  document.getElementById('locate-btn')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const mediaId = btn.dataset.mediaId;
    if (mediaId && currentTabId) {
      chrome.runtime.sendMessage({
        action: 'HIGHLIGHT_MEDIA',
        tabId: currentTabId,
        mediaId,
      }).catch(() => {});
    }
  });

  // Deselect button
  document.getElementById('deselect-btn')?.addEventListener('click', () => {
    if (currentTabId) {
      chrome.runtime.sendMessage({
        action: 'CLEAR_SELECTION',
        tabId: currentTabId,
      }).catch(() => {});
    }
  });

  // Inventory items click
  document.querySelectorAll('.sp-live-media-item').forEach((itemEl) => {
    itemEl.addEventListener('click', () => {
      const mediaId = itemEl.dataset.mediaId;
      if (mediaId && currentTabId) {
        chrome.runtime.sendMessage({
          action: 'SELECT_MEDIA_FROM_PANEL',
          tabId: currentTabId,
          mediaId,
        }).catch(() => {});
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
