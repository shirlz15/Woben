/**
 * FORENSIGHT — Service Worker / Background Script (Phase 1)
 * 
 * Orchestrates real-time communication between:
 * - Content scripts (DOM detection, user interactions, exact selection)
 * - Side panel (live media inventory, exact media case viewer)
 * 
 * Manages deterministic tab-level state in memory & chrome.storage.local.
 * NO fake analysis scores or fabricated verdicts are generated in this phase.
 */

const STORAGE_PREFIX = 'forensight_tab_';

// ─── In-Memory Tab State Cache ──────────────────────────────────
const tabStateCache = new Map(); // tabId -> TabState

function createDefaultTabState(tabId = null) {
  return {
    tabId,
    url: '',
    title: '',
    inventory: [],
    counts: {
      images: 0,
      videos: 0,
      audio: 0,
      total: 0,
    },
    selectedMediaId: null,
    selectedMedia: null,
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

  // Broadcast state update to side panel
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
  chrome.runtime.sendMessage(message).catch(() => {
    // Side panel may be closed, ignore
  });
}

// ─── Action Click → Open Side Panel ─────────────────────────────
chrome.action.onClicked.addListener(async (tab) => {
  if (tab && tab.id) {
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (err) {
      console.warn('FORENSIGHT: Side panel open error:', err.message);
    }
  }
});

// Configure side panel behavior
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// ─── Runtime Message Router ─────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, payload } = message;
  const tabId = message.tabId || sender.tab?.id;

  switch (action) {
    // 1. Content Script reports updated media inventory
    case 'MEDIA_INVENTORY_UPDATED': {
      if (!tabId || !payload) {
        sendResponse({ success: false });
        return true;
      }

      getTabState(tabId).then((currentState) => {
        // If an item was previously selected, see if it is still in inventory
        let selectedMedia = currentState.selectedMedia;
        let selectedMediaId = currentState.selectedMediaId;

        if (payload.selectedMediaId) {
          selectedMediaId = payload.selectedMediaId;
          selectedMedia = payload.selectedMedia;
        } else if (selectedMediaId) {
          const matching = (payload.inventory || []).find((m) => m.mediaId === selectedMediaId);
          if (matching) {
            selectedMedia = matching;
          }
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

    // 2. Content Script reports an exact media item was selected
    case 'MEDIA_SELECTED': {
      const mediaItem = payload;
      if (!tabId || !mediaItem) {
        sendResponse({ success: false });
        return true;
      }

      // Automatically open side panel on user interaction if possible
      chrome.sidePanel.open({ tabId }).catch(() => {});

      getTabState(tabId).then((currentState) => {
        // Update inventory item if already in list
        const inventory = [...currentState.inventory];
        const existingIdx = inventory.findIndex((m) => m.mediaId === mediaItem.mediaId);
        if (existingIdx >= 0) {
          inventory[existingIdx] = { ...inventory[existingIdx], ...mediaItem, state: 'selected' };
        } else {
          inventory.unshift({ ...mediaItem, state: 'selected' });
        }

        // Set previous selected item state back to detected
        for (let i = 0; i < inventory.length; i++) {
          if (inventory[i].mediaId !== mediaItem.mediaId && inventory[i].state === 'selected') {
            inventory[i] = { ...inventory[i], state: 'detected' };
          }
        }

        updateTabState(tabId, {
          selectedMediaId: mediaItem.mediaId,
          selectedMedia: mediaItem,
          inventory,
        }).then(() => {
          sendResponse({ success: true, selectedMediaId: mediaItem.mediaId });
        });
      });
      return true;
    }

    // 3. User deselected media in content script
    case 'MEDIA_DESELECTED': {
      if (!tabId) {
        sendResponse({ success: false });
        return true;
      }
      updateTabState(tabId, {
        selectedMediaId: null,
        selectedMedia: null,
      }).then(() => sendResponse({ success: true }));
      return true;
    }

    // 4. Side Panel requests to select a specific media item
    case 'SELECT_MEDIA_FROM_PANEL': {
      const targetTabId = message.tabId || tabId;
      const targetMediaId = message.mediaId;

      if (!targetTabId || !targetMediaId) {
        sendResponse({ success: false, error: 'Missing tabId or mediaId' });
        return true;
      }

      // Instruct content script to select and highlight the element in page
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

    // 5. Highlight media in page
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

    // 6. Get Tab State for Side Panel
    case 'GET_TAB_STATE':
    case 'getState': {
      getTabState(tabId).then((state) => {
        // If inventory is empty, request fresh scan from content script
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
            .catch(() => {
              sendResponse(state);
            });
          return;
        }
        sendResponse(state);
      });
      return true;
    }

    // 7. Request Tab Rescan
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
            }).then((updated) => {
              sendResponse({ success: true, count: updated.counts.total });
            });
          } else {
            sendResponse({ success: false, error: 'No response from page' });
          }
        })
        .catch((err) => {
          sendResponse({ success: false, error: err.message });
        });
      return true;
    }

    // 8. Deselect / Clear selection from Side Panel
    case 'CLEAR_SELECTION': {
      if (tabId) {
        chrome.tabs.sendMessage(tabId, { action: 'DESELECT_MEDIA_ELEMENT' }).catch(() => {});
        updateTabState(tabId, {
          selectedMediaId: null,
          selectedMedia: null,
        }).then(() => sendResponse({ success: true }));
      } else {
        sendResponse({ success: false });
      }
      return true;
    }

    // 9. Legacy clearState
    case 'clearState': {
      clearTabState(tabId).then(() => sendResponse({ success: true }));
      return true;
    }

    default:
      sendResponse({ error: 'Unknown service worker action' });
  }
  return true;
});

// ─── Tab Event Listeners ────────────────────────────────────────

// Tab activated (switched)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  notifySidePanel({
    action: 'ACTIVE_TAB_CHANGED',
    tabId: activeInfo.tabId,
  });
});

// Tab updated (navigation or refresh)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    // Request fresh scan from content script
    try {
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
    } catch {}
  }
});

// Tab closed
chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabState(tabId);
});
