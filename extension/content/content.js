/**
 * FORENSIGHT — Content Script
 * 
 * Runs on every webpage to:
 * 1. Detect media elements (images, videos, audio)
 * 2. Listen for user interactions (click image, play video/audio)
 * 3. Trigger analysis on interaction
 * 4. Display forensic badges next to analyzed media
 * 5. Observe dynamic DOM changes for new media
 */
(function () {
  'use strict';

  if (window.__FORENSIGHT_INJECTED__) return;
  window.__FORENSIGHT_INJECTED__ = true;

  const BADGE_CLASS = 'forensight-badge';
  const MIN_IMAGE_SIZE = 80;
  const MAX_MEDIA_ITEMS = 50;

  // ─── Media Registry ─────────────────────────────────────────
  const mediaRegistry = new Map(); // id → { element, type, src, ... }
  let mediaCounter = 0;

  function registerMedia(element, type) {
    // Check if already registered
    if (element.__forensight_id) return element.__forensight_id;

    const src = getMediaSrc(element, type);
    if (!src) return null;

    const id = `fs-${type}-${mediaCounter++}-${hashStr(src)}`;
    element.__forensight_id = id;

    const info = {
      id,
      type,
      src,
      element,
      filename: extractFilename(src),
      width: element.naturalWidth || element.videoWidth || element.width || null,
      height: element.naturalHeight || element.videoHeight || element.height || null,
      duration: element.duration || null,
      alt: element.alt || '',
      analyzed: false,
      result: null,
    };

    mediaRegistry.set(id, info);
    return id;
  }

  function getMediaSrc(element, type) {
    if (type === 'image') {
      return element.currentSrc || element.src || null;
    }
    if (type === 'video' || type === 'audio') {
      const src = element.currentSrc || element.src;
      if (src) return src;
      const source = element.querySelector('source');
      return source ? source.src : null;
    }
    return null;
  }

  // ─── Media Detection (full scan) ───────────────────────────
  function detectAllMedia() {
    const results = [];
    const seen = new Set();

    // Images
    document.querySelectorAll('img').forEach(img => {
      const src = img.currentSrc || img.src;
      if (!src || src.startsWith('data:image/svg') || seen.has(src)) return;
      if ((img.naturalWidth || img.width) < MIN_IMAGE_SIZE && (img.naturalHeight || img.height) < MIN_IMAGE_SIZE) return;
      seen.add(src);
      const id = registerMedia(img, 'image');
      if (id) results.push(serializeMedia(mediaRegistry.get(id)));
    });

    // Videos
    document.querySelectorAll('video').forEach(video => {
      const src = getMediaSrc(video, 'video');
      if (!src || seen.has(src)) return;
      seen.add(src);
      const id = registerMedia(video, 'video');
      if (id) results.push(serializeMedia(mediaRegistry.get(id)));
    });

    // Audio
    document.querySelectorAll('audio').forEach(audio => {
      const src = getMediaSrc(audio, 'audio');
      if (!src || seen.has(src)) return;
      seen.add(src);
      const id = registerMedia(audio, 'audio');
      if (id) results.push(serializeMedia(mediaRegistry.get(id)));
    });

    return results.slice(0, MAX_MEDIA_ITEMS);
  }

  function serializeMedia(info) {
    if (!info) return null;
    const { element, analyzed, result, ...data } = info;
    return data;
  }

  // ─── Interaction Listeners ──────────────────────────────────
  function setupInteractionListeners() {
    // Image click
    document.addEventListener('click', (e) => {
      const img = e.target.closest('img');
      if (!img) return;
      if ((img.naturalWidth || img.width) < MIN_IMAGE_SIZE) return;

      const id = registerMedia(img, 'image');
      if (!id) return;

      // Don't block native behavior
      // Trigger analysis after a tiny delay
      setTimeout(() => {
        triggerMediaAnalysis(id);
      }, 50);
    }, true);

    // Video play
    document.addEventListener('play', (e) => {
      if (e.target.tagName !== 'VIDEO') return;
      const id = registerMedia(e.target, 'video');
      if (!id) return;
      triggerMediaAnalysis(id);
    }, true);

    // Audio play
    document.addEventListener('play', (e) => {
      if (e.target.tagName !== 'AUDIO') return;
      const id = registerMedia(e.target, 'audio');
      if (!id) return;
      triggerMediaAnalysis(id);
    }, true);
  }

  // ─── Trigger Analysis ──────────────────────────────────────
  function triggerMediaAnalysis(mediaId) {
    const info = mediaRegistry.get(mediaId);
    if (!info) return;

    // Show "analyzing" badge immediately
    attachBadge(info, null);

    // Send to background for analysis
    chrome.runtime.sendMessage({
      action: 'analyzeInteractedMedia',
      mediaItem: serializeMedia(info),
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('FORENSIGHT:', chrome.runtime.lastError.message);
        return;
      }
      if (response && response.result) {
        info.analyzed = true;
        info.result = response.result;
        attachBadge(info, response.result);
      }
    });
  }

  // ─── Badge Rendering ────────────────────────────────────────
  function attachBadge(info, result) {
    const element = info.element;
    if (!element) return;

    // Remove existing badge for this media
    const existingBadge = document.querySelector(`[data-forensight-id="${info.id}"]`);
    if (existingBadge) existingBadge.remove();

    const badge = document.createElement('div');
    badge.className = BADGE_CLASS;
    badge.dataset.forensightId = info.id;

    let statusClass, statusText;

    if (!result) {
      statusClass = 'forensight-pending';
      statusText = '🛡 Analyzing...';
    } else if (result.verdictStatus === 'manipulated') {
      statusClass = 'forensight-manipulated';
      statusText = `🛡 Manipulation Likely`;
    } else if (result.verdictStatus === 'authentic') {
      statusClass = 'forensight-authentic';
      statusText = `🛡 Authenticity Likely`;
    } else if (result.verdictStatus === 'inconclusive') {
      statusClass = 'forensight-inconclusive';
      statusText = '🛡 Inconclusive';
    } else {
      statusClass = 'forensight-pending';
      statusText = '🛡 Unavailable';
    }

    badge.classList.add(statusClass);
    badge.innerHTML = `<span class="forensight-badge-text">${statusText}</span>`;

    if (result && result.isDemo) {
      badge.innerHTML += `<span class="forensight-badge-demo">DEMO</span>`;
    }

    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      chrome.runtime.sendMessage({ action: 'badgeClicked', mediaId: info.id });
    });

    // Find positioning parent
    let parent;
    if (info.type === 'audio') {
      parent = element.closest('.post-audio') || element.parentElement;
    } else {
      parent = element.closest('.post-media') || element.parentElement;
    }
    if (!parent) return;

    const parentPosition = getComputedStyle(parent).position;
    if (parentPosition === 'static') parent.style.position = 'relative';

    parent.appendChild(badge);
  }

  // ─── Bulk Badge Update (for full tab scan) ─────────────────
  function updateBadgeForMedia(mediaId, result) {
    const info = mediaRegistry.get(mediaId);
    if (!info) return;
    info.analyzed = true;
    info.result = result;
    attachBadge(info, result);
  }

  // ─── MutationObserver ───────────────────────────────────────
  let observer = null;
  function startObserving() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          // Register new media elements
          if (node.tagName === 'IMG') registerMedia(node, 'image');
          if (node.tagName === 'VIDEO') registerMedia(node, 'video');
          if (node.tagName === 'AUDIO') registerMedia(node, 'audio');
          if (node.querySelectorAll) {
            node.querySelectorAll('img').forEach(img => registerMedia(img, 'image'));
            node.querySelectorAll('video').forEach(v => registerMedia(v, 'video'));
            node.querySelectorAll('audio').forEach(a => registerMedia(a, 'audio'));
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ─── Message Listener ───────────────────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'detectMedia': {
        const media = detectAllMedia();
        startObserving();
        sendResponse({ media });
        break;
      }
      case 'updateBadge': {
        updateBadgeForMedia(message.mediaId, message.result);
        sendResponse({ success: true });
        break;
      }
      case 'highlightMedia': {
        const info = mediaRegistry.get(message.mediaId);
        if (info && info.element) {
          info.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const el = info.element;
          const orig = el.style.outline;
          el.style.outline = '3px solid #3b82f6';
          el.style.outlineOffset = '2px';
          setTimeout(() => { el.style.outline = orig; el.style.outlineOffset = ''; }, 2500);
        }
        sendResponse({ success: true });
        break;
      }
      default:
        sendResponse({ error: 'Unknown content action' });
    }
    return true;
  });

  // ─── Utilities ──────────────────────────────────────────────
  function hashStr(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return Math.abs(h).toString(36).substring(0, 6);
  }

  function extractFilename(url) {
    try { return new URL(url, window.location.href).pathname.split('/').pop() || 'unknown'; }
    catch { return 'unknown'; }
  }

  // ─── Initialize ─────────────────────────────────────────────
  setupInteractionListeners();
  startObserving();

  // Register all existing media on page load
  document.querySelectorAll('img').forEach(img => {
    if ((img.naturalWidth || img.width) >= MIN_IMAGE_SIZE) registerMedia(img, 'image');
  });
  document.querySelectorAll('video').forEach(v => registerMedia(v, 'video'));
  document.querySelectorAll('audio').forEach(a => registerMedia(a, 'audio'));

})();
