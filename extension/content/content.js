/**
 * FORENSIGHT — Safe Real-Time Content Script
 *
 * Emergency lifecycle-safe version.
 *
 * Responsibilities:
 * - Detect images, videos and audio
 * - Maintain canonical media inventory
 * - Exact media selection
 * - Safe communication with service worker
 * - Trigger existing forensic backend
 * - Update FORENSIGHT badges
 * - MutationObserver / SPA support
 *
 * IMPORTANT:
 * This file does NOT redesign the side panel.
 * It preserves the existing message contract.
 */

(function () {
  'use strict';

  // ============================================================
  // EXTENSION LIFECYCLE SAFETY
  // ============================================================

  function isRuntimeValid() {
    try {
      return !!(
        typeof chrome !== 'undefined' &&
        chrome.runtime &&
        chrome.runtime.id
      );
    } catch {
      return false;
    }
  }

  function isContextInvalidated(error) {
    const message = String(error?.message || error || '');
    return message.toLowerCase().includes('extension context invalidated');
  }

  /**
   * Centralized safe runtime messaging.
   *
   * NEVER call chrome.runtime.sendMessage directly elsewhere
   * in this file.
   */
  function safeSendMessage(message, callback) {
    if (!isRuntimeValid()) {
      return false;
    }

    try {
      chrome.runtime.sendMessage(message, function (response) {
        try {
          if (chrome.runtime.lastError) {
            const errorMessage = chrome.runtime.lastError.message || '';

            if (
              !errorMessage.toLowerCase().includes(
                'extension context invalidated'
              )
            ) {
              console.debug(
                '[FORENSIGHT] runtime message:',
                errorMessage
              );
            }

            if (callback) callback(null);
            return;
          }

          if (callback) callback(response);
        } catch (error) {
          if (!isContextInvalidated(error)) {
            console.debug(
              '[FORENSIGHT] response handling failed:',
              error
            );
          }

          if (callback) callback(null);
        }
      });

      return true;
    } catch (error) {
      if (!isContextInvalidated(error)) {
        console.debug(
          '[FORENSIGHT] sendMessage failed:',
          error
        );
      }

      return false;
    }
  }

  // ============================================================
  // CONSTANTS
  // ============================================================

  const BADGE_CLASS = 'forensight-badge';
  const SELECTED_CLASS = 'forensight-selected-media';

  const MIN_IMAGE_DIM = 40;
  const MAX_MEDIA_ITEMS = 150;

  // ============================================================
  // STATE
  // ============================================================

  const mediaRegistry = new Map();

  let selectedMediaId = null;
  let elementSequence = 0;
  let inventoryDebounceTimer = null;
  let domObserver = null;

  // ============================================================
  // UTILITY
  // ============================================================

  function hashStr(value) {
    let hash = 0;
    const str = String(value || '');

    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }

    return Math.abs(hash).toString(36).substring(0, 8);
  }

  function extractFilename(url) {
    if (!url) return 'unknown_media';

    try {
      const parsed = new URL(url, window.location.href);
      const parts = parsed.pathname.split('/').filter(Boolean);

      return parts.pop() || parsed.hostname || 'media';
    } catch {
      return 'media';
    }
  }

  function getMediaSrc(element, modality) {
    if (!element) return null;

    if (modality === 'image') {
      return (
        element.currentSrc ||
        element.src ||
        element.getAttribute('src') ||
        null
      );
    }

    if (modality === 'video' || modality === 'audio') {
      const direct =
        element.currentSrc ||
        element.src ||
        null;

      if (direct) return direct;

      const source = element.querySelector('source');

      if (source) {
        return (
          source.src ||
          source.getAttribute('src') ||
          null
        );
      }
    }

    return null;
  }

  function checkAccessRestriction(element, modality, src) {
    if (!src) {
      return {
        isRestricted: true,
        reason: 'no-source'
      };
    }

    try {
      if (element && element.mediaKeys) {
        return {
          isRestricted: true,
          reason: 'drm-protected'
        };
      }

      const sourceURL = new URL(
        src,
        window.location.href
      );

      if (
        sourceURL.origin !== window.location.origin &&
        modality !== 'image'
      ) {
        return {
          isRestricted: true,
          reason: 'cross-origin'
        };
      }

      // Cross-origin images may still be selected.
      // Actual pixel extraction will determine whether
      // CORS prevents analysis.
    } catch {
      // Keep media selectable.
    }

    return {
      isRestricted: false,
      reason: null
    };
  }

  // ============================================================
  // MEDIA REGISTRATION
  // ============================================================

  function registerMedia(element, modality) {
    if (!element) return null;

    const src = getMediaSrc(element, modality);

    if (modality === 'image') {
      if (!src) return null;

      if (
        String(src).startsWith('data:image/svg')
      ) {
        return null;
      }

      const width =
        element.naturalWidth ||
        element.width ||
        element.clientWidth ||
        0;

      const height =
        element.naturalHeight ||
        element.height ||
        element.clientHeight ||
        0;

      if (
        element.complete &&
        width > 0 &&
        height > 0 &&
        (width < MIN_IMAGE_DIM ||
          height < MIN_IMAGE_DIM)
      ) {
        return null;
      }
    }

    let id = element.__forensight_id;

    if (!id) {
      elementSequence++;

      const sourceHash = hashStr(
        src || `${modality}-${elementSequence}`
      );

      id =
        `fs-${modality}-${elementSequence}-${sourceHash}`;

      try {
        element.__forensight_id = id;
      } catch {
        // Some host elements may reject custom properties.
      }
    }

    const restriction =
      checkAccessRestriction(
        element,
        modality,
        src
      );

    let record = mediaRegistry.get(id);

    if (!record) {
      record = {
        mediaId: id,
        modality,
        elementType: element.tagName,
        detectedAt: new Date().toISOString(),
        element,
        badgeState: 'ready',
        verdictText: null
      };
    } else {
      record.element = element;
    }

    record.sourceUrl = src;
    record.filename = extractFilename(src);

    record.width =
      element.naturalWidth ||
      element.videoWidth ||
      element.clientWidth ||
      0;

    record.height =
      element.naturalHeight ||
      element.videoHeight ||
      element.clientHeight ||
      0;

    record.duration =
      element.duration &&
      !Number.isNaN(element.duration)
        ? element.duration
        : 0;

    record.alt = element.alt || '';

    record.isRestricted =
      restriction.isRestricted;

    record.restrictionReason =
      restriction.reason;

    if (id === selectedMediaId) {
      record.state = 'selected';
    } else {
      record.state =
        record.isRestricted
          ? 'restricted'
          : 'detected';
    }

    mediaRegistry.set(id, record);

    attachBadge(record);

    return id;
  }

  // ============================================================
  // BADGES
  // ============================================================

  function attachBadge(record) {
    if (!record) return;

    const element = record.element;

    if (
      !element ||
      !document.contains(element)
    ) {
      return;
    }

    let badge = document.querySelector(
      `[data-forensight-id="${record.mediaId}"]`
    );

    if (!badge) {
      badge = document.createElement('div');

      badge.className = BADGE_CLASS;

      badge.dataset.forensightId =
        record.mediaId;

      badge.addEventListener(
        'click',
        function (event) {
          event.stopPropagation();
          event.preventDefault();

          selectMedia(
            record.mediaId,
            true
          );
        }
      );

      let parent;

      if (record.modality === 'audio') {
        parent =
          element.closest('.post-audio') ||
          element.parentElement;
      } else {
        parent =
          element.closest('.post-media') ||
          element.parentElement;
      }

      if (parent) {
        try {
          const computed =
            window.getComputedStyle(parent);

          if (computed.position === 'static') {
            parent.style.position = 'relative';
          }

          parent.appendChild(badge);
        } catch {
          // Badge is non-critical.
        }
      }
    }

    badge.className = BADGE_CLASS;

    let label = 'READY';

    if (record.badgeState === 'analyzing') {
      badge.classList.add(
        'forensight-analyzing'
      );

      label = 'ANALYZING';

    } else if (
      record.badgeState === 'authenticity'
    ) {
      badge.classList.add(
        'forensight-authenticity'
      );

      label = 'AUTHENTICITY LIKELY';

    } else if (
      record.badgeState === 'manipulation'
    ) {
      badge.classList.add(
        'forensight-manipulation'
      );

      label = 'MANIPULATION LIKELY';

    } else if (
      record.badgeState === 'inconclusive'
    ) {
      badge.classList.add(
        'forensight-inconclusive'
      );

      label = 'INCONCLUSIVE';

    } else if (
      record.badgeState === 'unavailable'
    ) {
      badge.classList.add(
        'forensight-unavailable'
      );

      label = 'UNAVAILABLE';

    } else if (record.isRestricted) {
      badge.classList.add(
        'forensight-restricted'
      );

      label = 'RESTRICTED';

    } else if (
      record.mediaId === selectedMediaId
    ) {
      badge.classList.add(
        'forensight-selected'
      );

      label = 'SELECTED';

    } else {
      badge.classList.add(
        'forensight-ready'
      );

      label = 'READY';
    }

    badge.innerHTML = `
      <span class="forensight-badge-dot"></span>
      <span class="forensight-badge-type">
        ${record.modality}
      </span>
      <span class="forensight-badge-text">
        FORENSIGHT · ${label}
      </span>
    `;
  }

  function updateBadgeStatus(
    mediaId,
    badgeState,
    verdictText = null
  ) {
    const record =
      mediaRegistry.get(mediaId);

    if (!record) return;

    record.badgeState = badgeState;
    record.verdictText = verdictText;

    attachBadge(record);
  }

  // ============================================================
  // IMAGE SIGNALS
  // ============================================================

  function computeLocalImageSignals(img) {
    try {
      if (!img) return null;

      const width =
        img.naturalWidth ||
        img.width ||
        img.clientWidth ||
        0;

      const height =
        img.naturalHeight ||
        img.height ||
        img.clientHeight ||
        0;

      if (!width || !height) {
        return null;
      }

      const canvas =
        document.createElement('canvas');

      const w =
        Math.min(width, 640);

      const h =
        Math.min(height, 480);

      canvas.width = w;
      canvas.height = h;

      const ctx =
        canvas.getContext(
          '2d',
          { willReadFrequently: true }
        );

      if (!ctx) return null;

      ctx.drawImage(
        img,
        0,
        0,
        w,
        h
      );

      const data =
        ctx.getImageData(
          0,
          0,
          w,
          h
        );

      const pixels = data.data;
      const count = w * h;

      if (!count) return null;

      let sumY = 0;

      const luminance =
        new Float32Array(count);

      const histogram =
        new Int32Array(256);

      for (let i = 0; i < count; i++) {
        const r = pixels[i * 4];
        const g = pixels[i * 4 + 1];
        const b = pixels[i * 4 + 2];

        const y =
          0.2126 * r +
          0.7152 * g +
          0.0722 * b;

        luminance[i] = y;
        sumY += y;

        histogram[
          Math.max(
            0,
            Math.min(
              255,
              Math.round(y)
            )
          )
        ]++;
      }

      const meanY =
        sumY / count;

      let variance = 0;

      for (let i = 0; i < count; i++) {
        const d =
          luminance[i] - meanY;

        variance += d * d;
      }

      const stdDev =
        Math.sqrt(
          variance / count
        );

      let entropy = 0;

      for (let i = 0; i < 256; i++) {
        if (!histogram[i]) continue;

        const p =
          histogram[i] / count;

        entropy -=
          p * Math.log2(p);
      }

      let edgeCount = 0;
      let edgeSum = 0;
      let residualSum = 0;
      let residualCount = 0;

      for (
        let y = 1;
        y < h - 1;
        y++
      ) {
        for (
          let x = 1;
          x < w - 1;
          x++
        ) {
          const index =
            y * w + x;

          const c =
            luminance[index];

          const left =
            luminance[index - 1];

          const right =
            luminance[index + 1];

          const top =
            luminance[index - w];

          const bottom =
            luminance[index + w];

          const gx =
            right - left;

          const gy =
            bottom - top;

          const magnitude =
            Math.sqrt(
              gx * gx +
              gy * gy
            );

          edgeSum += magnitude;

          if (magnitude > 35) {
            edgeCount++;
          }

          const residual =
            Math.abs(
              top +
              bottom +
              left +
              right -
              4 * c
            );

          residualSum += residual;
          residualCount++;
        }
      }

      const meanGradient =
        edgeSum /
        Math.max(1, residualCount);

      const edgeDensity =
        edgeCount /
        Math.max(1, residualCount);

      const residualStdDev =
        residualSum /
        Math.max(1, residualCount);

      return {
        compression: {
          available: false,
          blockinessScore: null,
          gridDiscontinuityDetected: null
        },

        frequency: {
          available: false,
          spatialFrequencyScore: null
        },

        noise: {
          available: true,
          residualStdDev:
            Number(
              residualStdDev.toFixed(2)
            )
        },

        edges: {
          available: true,
          meanGradient:
            Number(
              meanGradient.toFixed(2)
            ),

          edgeDensity:
            Number(
              edgeDensity.toFixed(4)
            )
        },

        statistics: {
          luminanceMean:
            Number(
              meanY.toFixed(1)
            ),

          luminanceStdDev:
            Number(
              stdDev.toFixed(1)
            ),

          shannonEntropy:
            Number(
              entropy.toFixed(2)
            )
        }
      };

    } catch (error) {
      if (!isContextInvalidated(error)) {
        console.debug(
          '[FORENSIGHT] Local image signal extraction failed:',
          error
        );
      }

      return null;
    }
  }

  // ============================================================
  // IMAGE DATA CAPTURE
  // ============================================================

  function captureImageData(record) {
    if (
      !record ||
      !record.element ||
      record.element.tagName !== 'IMG' ||
      record.isRestricted
    ) {
      return null;
    }

    try {
      const img =
        record.element;

      const naturalWidth =
        img.naturalWidth ||
        img.clientWidth ||
        320;

      const naturalHeight =
        img.naturalHeight ||
        img.clientHeight ||
        240;

      const maxDim = 1600;

      let width =
        naturalWidth;

      let height =
        naturalHeight;

      if (
        width > maxDim ||
        height > maxDim
      ) {
        if (width > height) {
          height =
            Math.round(
              height *
              (maxDim / width)
            );

          width = maxDim;
        } else {
          width =
            Math.round(
              width *
              (maxDim / height)
            );

          height = maxDim;
        }
      }

      const canvas =
        document.createElement('canvas');

      canvas.width =
        Math.max(1, width);

      canvas.height =
        Math.max(1, height);

      const ctx =
        canvas.getContext('2d');

      if (!ctx) return null;

      ctx.drawImage(
        img,
        0,
        0,
        canvas.width,
        canvas.height
      );

      return canvas.toDataURL(
        'image/jpeg',
        0.92
      );

    } catch (error) {
      console.debug(
        '[FORENSIGHT] Image capture unavailable:',
        error?.message || error
      );

      return null;
    }
  }

  // ============================================================
  // IMAGE FORENSICS
  // ============================================================

  function triggerImageForensics(record) {
    if (!record) return;

    updateBadgeStatus(
      record.mediaId,
      'analyzing'
    );

    const localSignals =
      computeLocalImageSignals(
        record.element
      );

    const base64Data =
      captureImageData(record);

    const sent = safeSendMessage(
      {
        action: 'ANALYZE_IMAGE',

        payload: {
          mediaId:
            record.mediaId,

          sourceUrl:
            record.sourceUrl,

          imageData:
            base64Data,

          isRestricted:
            Boolean(
              record.isRestricted
            ),

          capture: {
            width:
              record.width,

            height:
              record.height,

            mimeType:
              'image/jpeg',

            fileSize:
              null
          },

          metadata: {
            available: false,
            format: null,
            hasExif: false,
            fields: {}
          },

          signals:
            localSignals
        }
      },

      function (response) {
        if (!response) {
          updateBadgeStatus(
            record.mediaId,
            'unavailable'
          );

          return;
        }

        if (
          response.error ===
          'MEDIA ACCESS RESTRICTED'
        ) {
          updateBadgeStatus(
            record.mediaId,
            'restricted',
            'RESTRICTED'
          );

          return;
        }

        if (
          response.reasoningStatus ===
          'ENGINE_UNAVAILABLE'
        ) {
          updateBadgeStatus(
            record.mediaId,
            'unavailable'
          );

          return;
        }

        if (
          response.verdict === 'REAL' ||
          response.verdict ===
            'AUTHENTICITY_LIKELY'
        ) {
          updateBadgeStatus(
            record.mediaId,
            'authenticity',
            response.verdict
          );

        } else if (
          response.verdict ===
            'MANIPULATED' ||
          response.verdict ===
            'MANIPULATION_LIKELY' ||
          response.verdict ===
            'AI_GENERATED'
        ) {
          updateBadgeStatus(
            record.mediaId,
            'manipulation',
            response.verdict
          );

        } else if (
          response.verdict ===
          'INCONCLUSIVE'
        ) {
          updateBadgeStatus(
            record.mediaId,
            'inconclusive',
            'INCONCLUSIVE'
          );
        }
      }
    );

    if (!sent) {
      updateBadgeStatus(
        record.mediaId,
        'unavailable'
      );
    }
  }

  // ============================================================
  // VIDEO FORENSICS
  // ============================================================

  function sampleVideoKeyframes(video) {
    try {
      if (!video) return [];

      const duration =
        video.duration &&
        !Number.isNaN(video.duration) &&
        video.duration > 0
          ? video.duration
          : null;

      if (!duration) {
        return [];
      }

      const offsets = [
        0.1,
        0.25,
        0.5,
        0.75,
        0.95
      ];

      return offsets.map(
        function (ratio, index) {
          return {
            timestamp:
              Number(
                (
                  ratio *
                  duration
                ).toFixed(2)
              ),

            frameIndex:
              index,

            signals: null
          };
        }
      );

    } catch {
      return [];
    }
  }

  function triggerVideoForensics(record) {
    if (!record) return;

    updateBadgeStatus(
      record.mediaId,
      'analyzing'
    );

    const sampledFrames =
      record.element &&
      record.element.tagName ===
        'VIDEO'
        ? sampleVideoKeyframes(
            record.element
          )
        : [];

    const sent = safeSendMessage(
      {
        action: 'ANALYZE_VIDEO',

        payload: {
          mediaId:
            record.mediaId,

          sourceUrl:
            record.sourceUrl,

          metadata: {
            width:
              record.width,

            height:
              record.height,

            duration:
              record.duration,

            mimeType:
              'video/mp4'
          },

          sampledFrames
        }
      },

      function (response) {
        if (!response) {
          updateBadgeStatus(
            record.mediaId,
            'unavailable'
          );

          return;
        }

        if (
          response.reasoningStatus ===
          'ENGINE_UNAVAILABLE'
        ) {
          updateBadgeStatus(
            record.mediaId,
            'unavailable'
          );

          return;
        }

        if (
          response.verdict ===
          'AUTHENTICITY_LIKELY'
        ) {
          updateBadgeStatus(
            record.mediaId,
            'authenticity',
            'AUTHENTICITY LIKELY'
          );

        } else if (
          response.verdict ===
          'MANIPULATION_LIKELY'
        ) {
          updateBadgeStatus(
            record.mediaId,
            'manipulation',
            'MANIPULATION LIKELY'
          );

        } else if (
          response.verdict ===
          'INCONCLUSIVE'
        ) {
          updateBadgeStatus(
            record.mediaId,
            'inconclusive',
            'INCONCLUSIVE'
          );
        }
      }
    );

    if (!sent) {
      updateBadgeStatus(
        record.mediaId,
        'unavailable'
      );
    }
  }

  // ============================================================
  // SERIALIZATION
  // ============================================================

  function serializeMedia(record) {
    if (!record) return null;

    return {
      mediaId:
        record.mediaId,

      modality:
        record.modality,

      sourceUrl:
        record.sourceUrl,

      elementType:
        record.elementType,

      width:
        record.width,

      height:
        record.height,

      duration:
        record.duration,

      detectedAt:
        record.detectedAt,

      state:
        record.state,

      filename:
        record.filename,

      isRestricted:
        record.isRestricted,

      restrictionReason:
        record.restrictionReason,

      alt:
        record.alt
    };
  }

  // ============================================================
  // INVENTORY
  // ============================================================

  function cleanStaleMedia() {
    for (
      const [
        id,
        record
      ] of mediaRegistry.entries()
    ) {
      if (
        !record.element ||
        !document.contains(
          record.element
        )
      ) {
        const badge =
          document.querySelector(
            `[data-forensight-id="${id}"]`
          );

        if (badge) {
          badge.remove();
        }

        mediaRegistry.delete(id);

        if (
          selectedMediaId === id
        ) {
          selectedMediaId = null;
        }
      }
    }
  }

  function getSerializedInventory() {
    cleanStaleMedia();

    return Array.from(
      mediaRegistry.values()
    )
      .map(serializeMedia)
      .slice(0, MAX_MEDIA_ITEMS);
  }

  function getInventoryCounts() {
    let images = 0;
    let videos = 0;
    let audio = 0;

    for (
      const record of
        mediaRegistry.values()
    ) {
      if (
        !record.element ||
        !document.contains(
          record.element
        )
      ) {
        continue;
      }

      if (
        record.modality ===
        'image'
      ) {
        images++;
      } else if (
        record.modality ===
        'video'
      ) {
        videos++;
      } else if (
        record.modality ===
        'audio'
      ) {
        audio++;
      }
    }

    return {
      images,
      videos,
      audio,
      total:
        images +
        videos +
        audio
    };
  }

  function syncInventoryNow() {
    const inventory =
      getSerializedInventory();

    const counts =
      getInventoryCounts();

    const selectedRecord =
      selectedMediaId
        ? mediaRegistry.get(
            selectedMediaId
          )
        : null;

    safeSendMessage({
      action:
        'MEDIA_INVENTORY_UPDATED',

      payload: {
        inventory,

        counts,

        selectedMediaId,

        selectedMedia:
          serializeMedia(
            selectedRecord
          ),

        url:
          window.location.href,

        title:
          document.title
      }
    });
  }

  function scheduleInventorySync() {
    if (
      inventoryDebounceTimer
    ) {
      clearTimeout(
        inventoryDebounceTimer
      );
    }

    inventoryDebounceTimer =
      setTimeout(
        syncInventoryNow,
        150
      );
  }

  // ============================================================
  // SELECTION
  // ============================================================

  function selectMedia(
    mediaId,
    shouldNotifyBackground = true
  ) {
    if (!mediaId) return;

    const record =
      mediaRegistry.get(
        mediaId
      );

    if (
      !record ||
      !record.element
    ) {
      return;
    }

    // Remove previous selection.
    if (
      selectedMediaId &&
      selectedMediaId !==
        mediaId
    ) {
      const previous =
        mediaRegistry.get(
          selectedMediaId
        );

      if (
        previous &&
        previous.element
      ) {
        previous.element.classList.remove(
          SELECTED_CLASS
        );

        previous.element.classList.remove(
          'forensight-pulse-highlight'
        );

        previous.state =
          previous.isRestricted
            ? 'restricted'
            : 'detected';

        previous.badgeState =
          'ready';

        attachBadge(
          previous
        );
      }
    }

    selectedMediaId =
      mediaId;

    record.state =
      record.isRestricted
        ? 'restricted'
        : 'selected';

    record.element.classList.add(
      SELECTED_CLASS
    );

    attachBadge(record);

    // CRITICAL:
    // send the EXACT selected media to the background.
    if (
      shouldNotifyBackground
    ) {
      safeSendMessage({
        action:
          'MEDIA_SELECTED',

        payload:
          serializeMedia(
            record
          )
      });
    }

    // Keep side panel inventory synchronized.
    scheduleInventorySync();

    // Start analysis only for accessible media.
    if (!record.isRestricted) {
      if (
        record.modality ===
        'image'
      ) {
        triggerImageForensics(
          record
        );
      } else if (
        record.modality ===
        'video'
      ) {
        triggerVideoForensics(
          record
        );
      }
    }
  }

  function deselectMedia(
    shouldNotifyBackground = true
  ) {
    if (!selectedMediaId) {
      return;
    }

    const previous =
      mediaRegistry.get(
        selectedMediaId
      );

    if (
      previous &&
      previous.element
    ) {
      previous.element.classList.remove(
        SELECTED_CLASS
      );

      previous.element.classList.remove(
        'forensight-pulse-highlight'
      );

      previous.state =
        previous.isRestricted
          ? 'restricted'
          : 'detected';

      previous.badgeState =
        'ready';

      attachBadge(previous);
    }

    selectedMediaId = null;

    if (
      shouldNotifyBackground
    ) {
      safeSendMessage({
        action:
          'MEDIA_DESELECTED'
      });
    }

    scheduleInventorySync();
  }

  function highlightMediaElement(
    mediaId
  ) {
    const record =
      mediaRegistry.get(
        mediaId
      );

    if (
      !record ||
      !record.element
    ) {
      return;
    }

    try {
      record.element.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      record.element.classList.add(
        'forensight-pulse-highlight'
      );

      setTimeout(
        function () {
          if (
            record.element
          ) {
            record.element.classList.remove(
              'forensight-pulse-highlight'
            );
          }
        },
        2200
      );
    } catch {
      // Highlight is non-critical.
    }
  }

  // ============================================================
  // SCAN
  // ============================================================

  function scanAllMedia() {
    try {
      document
        .querySelectorAll('img')
        .forEach(
          function (img) {
            registerMedia(
              img,
              'image'
            );
          }
        );

      document
        .querySelectorAll('video')
        .forEach(
          function (video) {
            registerMedia(
              video,
              'video'
            );
          }
        );

      document
        .querySelectorAll('audio')
        .forEach(
          function (audio) {
            registerMedia(
              audio,
              'audio'
            );
          }
        );

      scheduleInventorySync();

    } catch (error) {
      console.debug(
        '[FORENSIGHT] Scan failed:',
        error
      );
    }
  }

  // ============================================================
  // INTERACTION
  // ============================================================

  function setupInteractionListeners() {

    // IMAGE CLICK
    document.addEventListener(
      'click',
      function (event) {
        try {
          const img =
            event.target.closest(
              'img'
            );

          if (!img) return;

          const id =
            registerMedia(
              img,
              'image'
            );

          if (id) {
            selectMedia(
              id,
              true
            );
          }
        } catch (error) {
          console.debug(
            '[FORENSIGHT] Image selection failed:',
            error
          );
        }
      },
      true
    );

    // VIDEO PLAY
    document.addEventListener(
      'play',
      function (event) {
        try {
          const video =
            event.target;

          if (
            !video ||
            video.tagName !==
              'VIDEO'
          ) {
            return;
          }

          const id =
            registerMedia(
              video,
              'video'
            );

          if (id) {
            selectMedia(
              id,
              true
            );
          }
        } catch (error) {
          console.debug(
            '[FORENSIGHT] Video selection failed:',
            error
          );
        }
      },
      true
    );

    // VIDEO CLICK
    document.addEventListener(
      'click',
      function (event) {
        try {
          const video =
            event.target.closest(
              'video'
            );

          if (!video) return;

          const id =
            registerMedia(
              video,
              'video'
            );

          if (id) {
            selectMedia(
              id,
              true
            );
          }
        } catch (error) {
          console.debug(
            '[FORENSIGHT] Video click failed:',
            error
          );
        }
      },
      true
    );

    // AUDIO PLAY
    document.addEventListener(
      'play',
      function (event) {
        try {
          const audio =
            event.target;

          if (
            !audio ||
            audio.tagName !==
              'AUDIO'
          ) {
            return;
          }

          const id =
            registerMedia(
              audio,
              'audio'
            );

          if (id) {
            selectMedia(
              id,
              true
            );
          }
        } catch (error) {
          console.debug(
            '[FORENSIGHT] Audio selection failed:',
            error
          );
        }
      },
      true
    );

    // METADATA
    document.addEventListener(
      'loadedmetadata',
      function (event) {
        try {
          const element =
            event.target;

          if (
            element.tagName ===
            'VIDEO'
          ) {
            const id =
              registerMedia(
                element,
                'video'
              );

            if (
              id ===
              selectedMediaId
            ) {
              syncInventoryNow();
            }

          } else if (
            element.tagName ===
            'AUDIO'
          ) {
            const id =
              registerMedia(
                element,
                'audio'
              );

            if (
              id ===
              selectedMediaId
            ) {
              syncInventoryNow();
            }
          }
        } catch {
          // Metadata updates are non-critical.
        }
      },
      true
    );
  }

  // ============================================================
  // MUTATION OBSERVER
  // ============================================================

  function startDOMObservation() {
    if (domObserver) return;

    const root =
      document.documentElement ||
      document.body;

    if (!root) return;

    domObserver =
      new MutationObserver(
        function (mutations) {
          let changed = false;

          for (
            const mutation of
              mutations
          ) {
            if (
              mutation.type !==
              'childList'
            ) {
              continue;
            }

            for (
              const node of
                mutation.addedNodes
            ) {
              if (
                node.nodeType !==
                Node.ELEMENT_NODE
              ) {
                continue;
              }

              if (
                node.classList &&
                node.classList.contains(
                  BADGE_CLASS
                )
              ) {
                continue;
              }

              if (
                node.tagName ===
                'IMG'
              ) {
                registerMedia(
                  node,
                  'image'
                );

                changed = true;
              }

              if (
                node.tagName ===
                'VIDEO'
              ) {
                registerMedia(
                  node,
                  'video'
                );

                changed = true;
              }

              if (
                node.tagName ===
                'AUDIO'
              ) {
                registerMedia(
                  node,
                  'audio'
                );

                changed = true;
              }

              if (
                node.querySelectorAll
              ) {
                node
                  .querySelectorAll(
                    'img'
                  )
                  .forEach(
                    function (img) {
                      registerMedia(
                        img,
                        'image'
                      );

                      changed = true;
                    }
                  );

                node
                  .querySelectorAll(
                    'video'
                  )
                  .forEach(
                    function (video) {
                      registerMedia(
                        video,
                        'video'
                      );

                      changed = true;
                    }
                  );

                node
                  .querySelectorAll(
                    'audio'
                  )
                  .forEach(
                    function (audio) {
                      registerMedia(
                        audio,
                        'audio'
                      );

                      changed = true;
                    }
                  );
              }
            }
          }

          if (changed) {
            scheduleInventorySync();
          }
        }
      );

    domObserver.observe(
      root,
      {
        childList: true,
        subtree: true
      }
    );
  }

  // ============================================================
  // SPA NAVIGATION
  // ============================================================

  function setupSPANavigation() {
    const handleNavigation =
      function () {
        setTimeout(
          scanAllMedia,
          300
        );
      };

    window.addEventListener(
      'popstate',
      handleNavigation
    );

    window.addEventListener(
      'hashchange',
      handleNavigation
    );

    const originalPushState =
      history.pushState;

    if (originalPushState) {
      history.pushState =
        function () {
          const result =
            originalPushState.apply(
              this,
              arguments
            );

          handleNavigation();

          return result;
        };
    }

    const originalReplaceState =
      history.replaceState;

    if (originalReplaceState) {
      history.replaceState =
        function () {
          const result =
            originalReplaceState.apply(
              this,
              arguments
            );

          handleNavigation();

          return result;
        };
    }
  }

  // ============================================================
  // MESSAGE LISTENER
  // ============================================================

  if (
    typeof chrome !== 'undefined' &&
    chrome.runtime &&
    chrome.runtime.onMessage
  ) {
    chrome.runtime.onMessage.addListener(
      function (
        message,
        sender,
        sendResponse
      ) {
        try {
          if (!message) {
            sendResponse({
              success: false
            });

            return true;
          }

          switch (
            message.action
          ) {

            case 'SCAN_TAB_MEDIA':
            case 'detectMedia': {
              scanAllMedia();

              sendResponse({
                success: true,

                inventory:
                  getSerializedInventory(),

                counts:
                  getInventoryCounts(),

                selectedMediaId
              });

              break;
            }

            case 'SELECT_MEDIA_ELEMENT': {
              if (
                message.mediaId
              ) {
                selectMedia(
                  message.mediaId,
                  false
                );

                highlightMediaElement(
                  message.mediaId
                );

                sendResponse({
                  success: true
                });

              } else {
                sendResponse({
                  success: false,
                  error:
                    'No mediaId provided'
                });
              }

              break;
            }

            case 'DESELECT_MEDIA_ELEMENT': {
              deselectMedia(false);

              sendResponse({
                success: true
              });

              break;
            }

            case 'UPDATE_BADGE_STATUS': {
              updateBadgeStatus(
                message.mediaId,
                message.badgeState,
                message.verdictText
              );

              sendResponse({
                success: true
              });

              break;
            }

            case 'HIGHLIGHT_MEDIA':
            case 'highlightMedia': {
              if (
                message.mediaId
              ) {
                highlightMediaElement(
                  message.mediaId
                );

                sendResponse({
                  success: true
                });

              } else {
                sendResponse({
                  success: false
                });
              }

              break;
            }

            default:
              sendResponse({
                success: false,
                error:
                  'Unhandled content action'
              });
          }

        } catch (error) {
          if (
            !isContextInvalidated(
              error
            )
          ) {
            console.debug(
              '[FORENSIGHT] Message handler error:',
              error
            );
          }

          try {
            sendResponse({
              success: false,
              error:
                'Content script unavailable'
            });
          } catch {
            // Context may already be gone.
          }
        }

        return true;
      }
    );
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  try {
    setupInteractionListeners();

    setupSPANavigation();

    startDOMObservation();

    scanAllMedia();

    window.addEventListener(
      'load',
      scanAllMedia
    );

    console.debug(
      '[FORENSIGHT] Content script initialized'
    );

  } catch (error) {
    if (
      !isContextInvalidated(error)
    ) {
      console.error(
        '[FORENSIGHT] Initialization failed:',
        error
      );
    }
  }

})();