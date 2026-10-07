/**
 * FORENSIGHT — Service Worker / Background Script (Phase 2 & Phase 3)
 * 
 * Orchestrates real-time communication between:
 * - Content scripts (DOM detection, user interactions, exact selection, frame sampling)
 * - Side panel (live media inventory, live forensic report, video timeline)
 * - Forensic Backend at http://localhost:8000 (Image/Video signal extraction & Claude reasoning)
 * 
 * Manages deterministic tab-level state in memory & chrome.storage.local.
 * NO fabricated authenticity scores or fake demo data in live mode.
 */

const STORAGE_PREFIX = 'forensight_tab_';
const BACKEND_URL = 'http://localhost:8000';

// ─── In-Memory Tab State Cache ──────────────────────────────────
const tabStateCache = new Map(); // tabId -> TabState

function createDefaultTabState(tabId = null) {
  return {
    tabId,
    url: '',
    title: '',
    status: 'idle', // 'idle' | 'capturing' | 'analyzing' | 'evidence_ready' | 'reasoning' | 'verdict' | 'engine_unavailable' | 'restricted'
    inventory: [],
    counts: { images: 0, videos: 0, audio: 0, total: 0 },
    selectedMediaId: null,
    selectedMedia: null,
    analysisResult: null,
    lastUpdated: Date.now(),
  };
}

async function getTabState(tabId) {
  if (!tabId) return createDefaultTabState();
  if (tabStateCache.has(tabId)) {
    return tabStateCache.get(tabId);
  }
  const key = `${STORAGE_PREFIX}${tabId}`;
  const stored = await chrome.storage.local.get(key);
  if (stored && stored[key]) {
    tabStateCache.set(tabId, stored[key]);
    return stored[key];
  }
  const defaultState = createDefaultTabState(tabId);
  tabStateCache.set(tabId, defaultState);
  return defaultState;
}

async function updateTabState(tabId, updates) {
  if (!tabId) return;
  const current = await getTabState(tabId);
  const updated = {
    ...current,
    ...updates,
    tabId,
    lastUpdated: Date.now(),
  };

  tabStateCache.set(tabId, updated);
  const key = `${STORAGE_PREFIX}${tabId}`;
  await chrome.storage.local.set({ [key]: updated });

  notifySidePanel({
    action: 'TAB_STATE_CHANGED',
    tabId,
    state: updated,
  });

  return updated;
}

async function clearTabState(tabId) {
  if (!tabId) return;
  tabStateCache.delete(tabId);
  const key = `${STORAGE_PREFIX}${tabId}`;
  await chrome.storage.local.remove(key);

  notifySidePanel({
    action: 'TAB_STATE_CLEARED',
    tabId,
    state: createDefaultTabState(tabId),
  });
}

function notifySidePanel(message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}

// ─── Extension Action (Icon Click) ──────────────────────────────
chrome.action.onClicked.addListener(async (tab) => {
  if (tab && tab.id) {
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (err) {
      console.warn('FORENSIGHT: Side panel open error:', err.message);
    }
  }
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// ─── Forensic Backend Dispatchers ───────────────────────────────
async function processImageAnalysis(payload, tabId) {
  try {
    // 1. Capturing
    await updateTabState(tabId, {
      status: 'capturing',
      selectedMediaId: payload.mediaId,
      analysisResult: null,
    });

    // 2. Analyzing
    await updateTabState(tabId, { status: 'analyzing' });

    const response = await fetch(`${BACKEND_URL}/api/analyze-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      throw new Error(`Backend returned HTTP ${response.status}`);
    }

    const data = await response.json();

    // 3. Evidence Ready
    await updateTabState(tabId, { status: 'evidence_ready' });

    // 4. Reasoning
    await updateTabState(tabId, { status: 'reasoning' });

    // 5. Verdict
    const finalState = await updateTabState(tabId, {
      status: 'verdict',
      analysisResult: data,
    });

    // Notify content script badge
    const badgeState = data.verdict === 'AUTHENTICITY_LIKELY' ? 'authenticity' :
                       data.verdict === 'MANIPULATION_LIKELY' ? 'manipulation' : 'inconclusive';
    chrome.tabs.sendMessage(tabId, {
      action: 'UPDATE_BADGE_STATUS',
      mediaId: payload.mediaId,
      badgeState,
      verdictText: data.verdict,
    }).catch(() => {});

    return data;
  } catch (err) {
    console.warn('FORENSIGHT Image Analysis Error:', err.message);

    await updateTabState(tabId, {
      status: 'engine_unavailable',
      analysisResult: {
        error: 'FORENSIC ENGINE UNAVAILABLE',
        message: 'Could not connect to forensic backend at http://localhost:8000',
      },
    });

    chrome.tabs.sendMessage(tabId, {
      action: 'UPDATE_BADGE_STATUS',
      mediaId: payload.mediaId,
      badgeState: 'unavailable',
    }).catch(() => {});

    return { error: 'FORENSIC ENGINE UNAVAILABLE' };
  }
}

async function processVideoAnalysis(payload, tabId) {
  try {
    // 1. Capturing
    await updateTabState(tabId, {
      status: 'capturing',
      selectedMediaId: payload.mediaId,
      analysisResult: null,
    });

    // 2. Analyzing
    await updateTabState(tabId, { status: 'analyzing' });

    const response = await fetch(`${BACKEND_URL}/api/analyze-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25000),
    });

    if (!response.ok) {
      throw new Error(`Backend returned HTTP ${response.status}`);
    }

    const data = await response.json();

    // 3. Evidence Ready
    await updateTabState(tabId, { status: 'evidence_ready' });

    // 4. Reasoning
    await updateTabState(tabId, { status: 'reasoning' });

    // 5. Verdict
    const finalState = await updateTabState(tabId, {
      status: 'verdict',
      analysisResult: data,
    });

    // Notify content script badge
    const badgeState = data.verdict === 'AUTHENTICITY_LIKELY' ? 'authenticity' :
                       data.verdict === 'MANIPULATION_LIKELY' ? 'manipulation' : 'inconclusive';
    chrome.tabs.sendMessage(tabId, {
      action: 'UPDATE_BADGE_STATUS',
      mediaId: payload.mediaId,
      badgeState,
      verdictText: data.verdict,
    }).catch(() => {});

    return data;
  } catch (err) {
    console.warn('FORENSIGHT Video Analysis Error:', err.message);

    await updateTabState(tabId, {
      status: 'engine_unavailable',
      analysisResult: {
        error: 'FORENSIC ENGINE UNAVAILABLE',
        message: 'Could not connect to forensic backend at http://localhost:8000',
      },
    });

    chrome.tabs.sendMessage(tabId, {
      action: 'UPDATE_BADGE_STATUS',
      mediaId: payload.mediaId,
      badgeState: 'unavailable',
    }).catch(() => {});

    return { error: 'FORENSIC ENGINE UNAVAILABLE' };
  }
}

// ─── Runtime Message Router ─────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, payload } = message;
  const tabId = message.tabId || sender.tab?.id;

  switch (action) {
    // Phase 2: Image Forensics Trigger
    case 'ANALYZE_IMAGE': {
      if (!tabId || !payload) {
        sendResponse({ success: false });
        return true;
      }
      processImageAnalysis(payload, tabId).then(sendResponse);
      return true;
    }

    // Phase 3: Video Forensics Trigger
    case 'ANALYZE_VIDEO': {
      if (!tabId || !payload) {
        sendResponse({ success: false });
        return true;
      }
      processVideoAnalysis(payload, tabId).then(sendResponse);
      return true;
    }

    case 'MEDIA_INVENTORY_UPDATED': {
      if (!tabId || !payload) {
        sendResponse({ success: false });
        return true;
      }
      getTabState(tabId).then((currentState) => {
        let selectedMedia = currentState.selectedMedia;
        let selectedMediaId = currentState.selectedMediaId;

        if (payload.selectedMediaId) {
          selectedMediaId = payload.selectedMediaId;
          selectedMedia = payload.selectedMedia;
        } else if (selectedMediaId) {
          const matching = (payload.inventory || []).find((m) => m.mediaId === selectedMediaId);
          if (matching) selectedMedia = matching;
        }

        updateTabState(tabId, {
          inventory: payload.inventory || [],
          counts: payload.counts || { images: 0, videos: 0, audio: 0, total: 0 },
          selectedMediaId,
          selectedMedia,
          url: payload.url || currentState.url,
          title: payload.title || currentState.title,
        }).then((state) => {
          sendResponse({ success: true, count: state.counts.total });
        });
      });
      return true;
    }

    case 'MEDIA_SELECTED': {
      const mediaItem = payload;
      if (!tabId || !mediaItem) {
        sendResponse({ success: false });
        return true;
      }

      chrome.sidePanel.open({ tabId }).catch(() => {});

      getTabState(tabId).then((currentState) => {
        const inventory = [...currentState.inventory];
        const existingIdx = inventory.findIndex((m) => m.mediaId === mediaItem.mediaId);
        if (existingIdx >= 0) {
          inventory[existingIdx] = { ...inventory[existingIdx], ...mediaItem, state: 'selected' };
        } else {
          inventory.unshift({ ...mediaItem, state: 'selected' });
        }

        for (let i = 0; i < inventory.length; i++) {
          if (inventory[i].mediaId !== mediaItem.mediaId && inventory[i].state === 'selected') {
            inventory[i] = { ...inventory[i], state: 'detected' };
          }
        }

        updateTabState(tabId, {
          selectedMediaId: mediaItem.mediaId,
          selectedMedia: mediaItem,
          inventory,
          status: mediaItem.isRestricted ? 'restricted' : (currentState.status === 'verdict' && currentState.selectedMediaId === mediaItem.mediaId ? 'verdict' : 'selected'),
        }).then(() => {
          sendResponse({ success: true, selectedMediaId: mediaItem.mediaId });
        });
      });
      return true;
    }

    case 'MEDIA_DESELECTED': {
      if (!tabId) { sendResponse({ success: false }); return true; }
      updateTabState(tabId, {
        selectedMediaId: null,
        selectedMedia: null,
        status: 'idle',
        analysisResult: null,
      }).then(() => sendResponse({ success: true }));
      return true;
    }

    case 'SELECT_MEDIA_FROM_PANEL': {
      const targetTabId = message.tabId || tabId;
      const targetMediaId = message.mediaId;
      if (!targetTabId || !targetMediaId) {
        sendResponse({ success: false, error: 'Missing tabId or mediaId' });
        return true;
      }

      chrome.tabs.sendMessage(targetTabId, {
        action: 'SELECT_MEDIA_ELEMENT',
        mediaId: targetMediaId,
      }).then(() => {
        getTabState(targetTabId).then((currentState) => {
          const item = currentState.inventory.find((m) => m.mediaId === targetMediaId);
          if (item) {
            updateTabState(targetTabId, {
              selectedMediaId: targetMediaId,
              selectedMedia: item,
            }).then(() => sendResponse({ success: true }));
          } else {
            sendResponse({ success: true });
          }
        });
      }).catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }

    case 'HIGHLIGHT_MEDIA':
    case 'highlightMedia': {
      const targetTabId = message.tabId || tabId;
      const targetMediaId = message.mediaId;
      if (targetTabId && targetMediaId) {
        chrome.tabs.sendMessage(targetTabId, {
          action: 'HIGHLIGHT_MEDIA',
          mediaId: targetMediaId,
        }).then(sendResponse).catch(() => sendResponse({ success: false }));
      } else {
        sendResponse({ success: false });
      }
      return true;
    }

    case 'GET_TAB_STATE':
    case 'getState': {
      getTabState(tabId).then((state) => {
        if (state.inventory.length === 0 && tabId) {
          chrome.tabs.sendMessage(tabId, { action: 'SCAN_TAB_MEDIA' })
            .then((res) => {
              if (res && res.inventory) {
                updateTabState(tabId, {
                  inventory: res.inventory,
                  counts: res.counts,
                  selectedMediaId: res.selectedMediaId,
                  selectedMedia: res.inventory.find((m) => m.mediaId === res.selectedMediaId) || null,
                }).then((freshState) => sendResponse(freshState));
                return;
              }
              sendResponse(state);
            })
            .catch(() => sendResponse(state));
          return;
        }
        sendResponse(state);
      });
      return true;
    }

    case 'SCAN_TAB':
    case 'scanTab': {
      const targetTabId = message.tabId || tabId;
      if (!targetTabId) {
        sendResponse({ success: false, error: 'No active tab' });
        return true;
      }
      chrome.tabs.sendMessage(targetTabId, { action: 'SCAN_TAB_MEDIA' })
        .then((res) => {
          if (res && res.inventory) {
            updateTabState(targetTabId, {
              inventory: res.inventory,
              counts: res.counts,
              selectedMediaId: res.selectedMediaId,
              selectedMedia: res.inventory.find((m) => m.mediaId === res.selectedMediaId) || null,
            }).then((updated) => sendResponse({ success: true, count: updated.counts.total }));
          } else {
            sendResponse({ success: false, error: 'No response from page' });
          }
        })
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case 'CLEAR_SELECTION': {
      if (tabId) {
        chrome.tabs.sendMessage(tabId, { action: 'DESELECT_MEDIA_ELEMENT' }).catch(() => {});
        updateTabState(tabId, {
          selectedMediaId: null,
          selectedMedia: null,
          status: 'idle',
          analysisResult: null,
        }).then(() => sendResponse({ success: true }));
      } else {
        sendResponse({ success: false });
      }
      return true;
    }

    default:
      sendResponse({ error: 'Unknown service worker action' });
  }
  return true;
});

// ─── Tab Event Listeners ────────────────────────────────────────
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  notifySidePanel({
    action: 'ACTIVE_TAB_CHANGED',
    tabId: activeInfo.tabId,
  });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    chrome.tabs.sendMessage(tabId, { action: 'SCAN_TAB_MEDIA' }, (res) => {
      if (chrome.runtime.lastError) return;
      if (res && res.inventory) {
        updateTabState(tabId, {
          inventory: res.inventory,
          counts: res.counts,
          url: tab.url,
          title: tab.title,
          selectedMediaId: res.selectedMediaId || null,
          selectedMedia: res.inventory.find((m) => m.mediaId === res.selectedMediaId) || null,
        });
      }
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabState(tabId);
});
