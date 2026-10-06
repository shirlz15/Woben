/**
 * FORENSIGHT — Service Worker (Background Script)
 * 
 * Orchestrates communication between:
 * - Content script (media detection, badges)
 * - Side panel (forensic report UI)
 * - Backend API (forensic analysis)
 * 
 * Manages analysis state in chrome.storage.local.
 */

// ─── Config ─────────────────────────────────────────────────────
const BACKEND_URL = 'http://localhost:8000'; // Local forensic backend
const STORAGE_KEY = 'forensight_state';

// ─── Extension Icon Click → Open Side Panel ─────────────────────
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (err) {
    console.warn('FORENSIGHT: Could not open side panel:', err.message);
  }
});

// ─── Side Panel Behavior ────────────────────────────────────────
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// ─── Message Router ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action } = message;

  switch (action) {
    case 'scanTab':
      handleScanTab(message.tabId).then(sendResponse);
      return true; // async

    case 'analyzeMedia':
      handleAnalyzeMedia(message.mediaItem, message.tabId).then(sendResponse);
      return true;

    case 'getState':
      getState(message.tabId).then(sendResponse);
      return true;

    case 'clearState':
      clearState(message.tabId).then(sendResponse);
      return true;

    case 'mediaDetected':
      // Content script reporting detected media
      handleMediaFromContent(message.media, sender.tab?.id).then(sendResponse);
      return true;

    case 'analyzeInteractedMedia':
      handleInteractedMedia(message.mediaItem, sender.tab?.id).then(sendResponse);
      return true;

    case 'badgeClicked':
      handleBadgeClick(message.mediaId, sender.tab?.id).then(sendResponse);
      return true;

    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// ─── Interaction-Based Analysis ─────────────────────────────────
async function handleInteractedMedia(mediaItem, tabId) {
  if (!mediaItem || !tabId) return { success: false, error: 'Missing data' };

  try {
    // Open side panel
    try { await chrome.sidePanel.open({ tabId }); } catch (e) {}

    // Get or create state for this tab
    const currentState = await getState(tabId);
    const media = currentState.media || [];
    const results = currentState.results || {};

    // Add media to list if not already there
    if (!media.find(m => m.id === mediaItem.id)) {
      media.push(mediaItem);
    }

    // Notify side panel: selected media, analyzing
    await updateState(tabId, {
      status: 'analyzing',
      stage: 'analyzing_media',
      media,
      results,
      selectedMediaId: mediaItem.id,
      totalMedia: media.length,
      analyzedCount: Object.keys(results).length,
      scanTimestamp: currentState.scanTimestamp || Date.now(),
    });

    // Analyze the media
    const result = await analyzeMediaItem(mediaItem);
    results[mediaItem.id] = result;

    // Update state with result
    await updateState(tabId, {
      status: 'complete',
      stage: 'complete',
      media,
      results,
      selectedMediaId: mediaItem.id,
      analyzedCount: Object.keys(results).length,
    });

    // Tell content script to update badge
    try {
      await chrome.tabs.sendMessage(tabId, {
        action: 'updateBadge',
        mediaId: mediaItem.id,
        result: result,
      });
    } catch (e) {}

    return { success: true, result };
  } catch (err) {
    console.error('FORENSIGHT interaction analysis error:', err);
    return { success: false, error: err.message };
  }
}

// ─── Tab Scanning ───────────────────────────────────────────────
async function handleScanTab(tabId) {
  try {
    // Update state: scanning
    await updateState(tabId, {
      status: 'scanning',
      stage: 'detecting_media',
      media: [],
      results: {},
      scanTimestamp: Date.now(),
    });

    // Tell content script to detect media
    const response = await chrome.tabs.sendMessage(tabId, { action: 'detectMedia' });

    if (!response || !response.media) {
      await updateState(tabId, { status: 'error', error: 'No media detected or content script unavailable' });
      return { success: false, error: 'Could not detect media' };
    }

    const media = response.media;

    // Update state with detected media
    await updateState(tabId, {
      status: 'analyzing',
      stage: 'media_detected',
      media: media,
      totalMedia: media.length,
      analyzedCount: 0,
    });

    // Analyze each media item
    for (let i = 0; i < media.length; i++) {
      await updateState(tabId, {
        stage: 'analyzing_media',
        currentMediaIndex: i,
        analyzedCount: i,
      });

      const result = await analyzeMediaItem(media[i]);
      
      const currentState = await getState(tabId);
      const results = currentState.results || {};
      results[media[i].id] = result;

      await updateState(tabId, {
        results: results,
        analyzedCount: i + 1,
      });

      // Tell content script to update badge for this media
      try {
        await chrome.tabs.sendMessage(tabId, {
          action: 'updateBadge',
          mediaId: media[i].id,
          result: result,
        });
      } catch (e) {
        // Content script may not be available
      }
    }

    // Final state
    await updateState(tabId, {
      status: 'complete',
      stage: 'complete',
      analyzedCount: media.length,
    });

    return { success: true, mediaCount: media.length };
  } catch (err) {
    console.error('FORENSIGHT scan error:', err);
    await updateState(tabId, { status: 'error', error: err.message });
    return { success: false, error: err.message };
  }
}

// ─── Single Media Analysis ──────────────────────────────────────
async function handleAnalyzeMedia(mediaItem, tabId) {
  try {
    const result = await analyzeMediaItem(mediaItem);
    
    const currentState = await getState(tabId);
    const results = currentState.results || {};
    results[mediaItem.id] = result;
    await updateState(tabId, { results });

    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── Backend Communication ──────────────────────────────────────
async function analyzeMediaItem(mediaItem) {
  try {
    // Try real backend first
    const response = await fetch(`${BACKEND_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: mediaItem.src,
        type: mediaItem.type,
        filename: mediaItem.filename || null,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (response.ok) {
      const data = await response.json();
      return { ...data, isDemo: false, backendUsed: true };
    }

    throw new Error(`Backend returned ${response.status}`);
  } catch (err) {
    // Backend unavailable — return demo result
    console.warn('FORENSIGHT: Backend unavailable, using demo mode for', mediaItem.id);
    return generateDemoResult(mediaItem);
  }
}

function generateDemoResult(mediaItem) {
  const hash = simpleHash(mediaItem.src || mediaItem.id);
  const variant = hash % 4;
  const mediaType = mediaItem.type === 'video' ? 'video' :
                    mediaItem.type === 'audio' ? 'audio' : 'image';

  const demoScenarios = [
    { verdictStatus: 'authentic', verdictScore: 6 + (hash % 8), verdictLabel: 'Authenticity Likely', evidenceConfidence: 'high' },
    { verdictStatus: 'manipulated', verdictScore: 82 + (hash % 14), verdictLabel: 'Manipulation Likely', evidenceConfidence: 'high' },
    { verdictStatus: 'inconclusive', verdictScore: 45 + (hash % 20), verdictLabel: 'Inconclusive', evidenceConfidence: 'low' },
    { verdictStatus: 'authentic', verdictScore: 3 + (hash % 6), verdictLabel: 'Authenticity Likely', evidenceConfidence: 'high' },
  ];

  const scenario = demoScenarios[variant];
  const signals = generateDemoSignals(mediaType, scenario.verdictStatus, hash);
  const activeSignals = signals.filter(s => s.activated);
  const relationships = generateDemoRelationships(activeSignals, scenario.verdictStatus);

  return {
    id: `FS-${hash.toString(36).toUpperCase().substring(0, 8)}`,
    mediaHash: generateHexHash(mediaItem.src),
    mediaType,
    mediaUrl: mediaItem.src,
    fileName: mediaItem.filename || `media_${mediaItem.id}`,
    analysisTimeMs: 1200 + (hash % 3000),
    timestamp: new Date().toISOString(),
    ...scenario,
    signals,
    relationships,
    stabilityResults: generateDemoStability(scenario.verdictScore, hash),
    suspiciousRegions: (mediaType === 'image' && scenario.verdictStatus === 'manipulated') ? [
      { x: 0.2 + (hash % 20) / 100, y: 0.15, width: 0.4, height: 0.5, intensity: 0.7 + (hash % 20) / 100 }
    ] : [],
    suspiciousSegments: (mediaType === 'video' || mediaType === 'audio') ? generateDemoSegments(mediaType, scenario.verdictStatus, hash) : [],
    crossModalSync: mediaType === 'video' ? generateDemoCrossModal(scenario.verdictStatus, hash) : null,
    explanations: generateDemoExplanations(mediaType, scenario.verdictStatus, hash),
    explanationSummary: scenario.verdictStatus === 'manipulated'
      ? 'Multiple independent signals support the manipulation hypothesis. Evidence shows convergence across analytical modules.'
      : scenario.verdictStatus === 'authentic'
      ? 'All analyzed signals are consistent with authentic, unmanipulated media.'
      : 'Evidence is contradictory across analytical modules. Manual verification recommended.',
    investigationFlow: generateInvestigationFlow(),
    activatedModules: getActivatedModules(mediaType),
    skippedModules: getSkippedModules(mediaType),
    contentDetected: mediaType === 'video' ? 'Face + Speech' : mediaType === 'audio' ? 'Speech' : 'Visual Content',
    isDemo: true,
    backendUsed: false,
  };
}

function getActivatedModules(mediaType) {
  if (mediaType === 'video') return ['Visual Artifacts', 'Temporal Analysis', 'Face Analysis', 'Audio Forensics', 'Lip-Sync', 'Compression'];
  if (mediaType === 'audio') return ['Spectral Analysis', 'Temporal Analysis', 'Voice Characteristics', 'Synthesis Indicators', 'Compression'];
  return ['Visual Integrity', 'Frequency Analysis', 'Noise / Residual', 'Metadata', 'Compression', 'Edge / Texture'];
}

function getSkippedModules(mediaType) {
  if (mediaType === 'video') return ['OCR', 'Document Analysis'];
  if (mediaType === 'audio') return ['Visual', 'Face', 'Lip-Sync', 'OCR'];
  return ['Audio', 'Lip-Sync', 'Temporal', 'Face'];
}

function generateDemoSignals(mediaType, verdict, hash) {
  const m = verdict === 'manipulated';
  const inc = verdict === 'inconclusive';

  // Direction: for manipulated, supporting = supports manipulation hypothesis
  // For authentic, contradicting = contradicts manipulation hypothesis (i.e. supports authenticity)
  const dirM = m ? 'supporting' : inc ? 'inconclusive' : 'contradicting';
  const dirMeta = m ? 'inconclusive' : inc ? 'inconclusive' : 'contradicting';

  if (mediaType === 'image') {
    return [
      { id: 'visual', type: 'visual', label: 'Visual Integrity', score: m ? 84 + (hash % 12) : inc ? 48 + (hash % 18) : 4 + (hash % 7), direction: dirM, reliability: 'high', activated: true,
        explanation: m ? 'Detectable artifacts in high-frequency regions suggest post-processing.' : inc ? 'Visual features are ambiguous.' : 'No visual manipulation artifacts detected.' },
      { id: 'frequency', type: 'frequency', label: 'Frequency Analysis', score: m ? 78 + (hash % 10) : inc ? 40 + (hash % 20) : 6 + (hash % 8), direction: dirM, reliability: 'high', activated: true,
        explanation: m ? 'Frequency-domain artifacts consistent with splicing or inpainting.' : 'Frequency spectrum consistent with camera capture.' },
      { id: 'noise', type: 'noise', label: 'Noise / Residual', score: m ? 72 + (hash % 15) : inc ? 55 + (hash % 15) : 8 + (hash % 10), direction: m ? 'supporting' : inc ? 'inconclusive' : 'contradicting', reliability: 'moderate', activated: true,
        explanation: m ? 'Noise pattern discontinuity across image regions.' : 'Noise profile is uniform and consistent.' },
      { id: 'metadata', type: 'metadata', label: 'Metadata', score: m ? 55 + (hash % 15) : 18 + (hash % 12), direction: dirMeta, reliability: 'moderate', activated: true,
        explanation: m ? 'Metadata inconsistencies found; editing software signatures detected.' : 'Metadata is internally consistent.' },
      { id: 'compression', type: 'compression', label: 'Compression', score: m ? 60 + (hash % 12) : 12 + (hash % 10), direction: m ? 'supporting' : 'contradicting', reliability: 'moderate', activated: true,
        explanation: m ? 'Double-compression artifacts detected.' : 'Single-pass compression consistent with original capture.' },
      { id: 'edge', type: 'edge', label: 'Edge / Texture', score: m ? 70 + (hash % 12) : inc ? 50 + (hash % 15) : 5 + (hash % 8), direction: dirM, reliability: 'moderate', activated: true,
        explanation: m ? 'Edge discontinuities found near suspected manipulation boundary.' : 'Edge characteristics are natural.' },
    ];
  }

  if (mediaType === 'video') {
    return [
      { id: 'visual', type: 'visual', label: 'Frame Analysis', score: m ? 86 + (hash % 10) : inc ? 52 + (hash % 18) : 5 + (hash % 6), direction: dirM, reliability: 'high', activated: true,
        explanation: m ? 'Frame-level visual artifacts detected across analyzed keyframes.' : 'Frame integrity verified.' },
      { id: 'temporal', type: 'temporal', label: 'Temporal Consistency', score: m ? 88 + (hash % 8) : inc ? 45 + (hash % 20) : 3 + (hash % 6), direction: dirM, reliability: 'high', activated: true,
        explanation: m ? 'Frame-to-frame temporal inconsistencies indicate manipulation.' : 'Temporal flow is consistent.' },
      { id: 'face', type: 'face', label: 'Face Analysis', score: m ? 90 + (hash % 8) : inc ? 50 + (hash % 15) : 4 + (hash % 5), direction: dirM, reliability: 'high', activated: true,
        explanation: m ? 'Facial geometry and texture anomalies detected.' : 'Facial characteristics are natural.' },
      { id: 'audio', type: 'audio', label: 'Audio Forensics', score: m ? 76 + (hash % 14) : inc ? 48 + (hash % 16) : 7 + (hash % 8), direction: m ? 'supporting' : inc ? 'inconclusive' : 'contradicting', reliability: 'moderate', activated: true,
        explanation: m ? 'Audio spectral anomalies detected.' : 'Audio characteristics are consistent.' },
      { id: 'lip_sync', type: 'lip_sync', label: 'Lip-Sync', score: m ? 82 + (hash % 12) : inc ? 55 + (hash % 18) : 6 + (hash % 7), direction: m ? 'supporting' : inc ? 'inconclusive' : 'contradicting', reliability: 'high', activated: true,
        explanation: m ? 'Lip movement timing does not match audio phonemes.' : 'Lip-sync is consistent with audio.' },
      { id: 'compression', type: 'compression', label: 'Compression', score: m ? 62 + (hash % 12) : 10 + (hash % 10), direction: m ? 'supporting' : 'contradicting', reliability: 'moderate', activated: true,
        explanation: m ? 'Compression artifacts suggest re-encoding.' : 'Compression profile is consistent.' },
    ];
  }

  if (mediaType === 'audio') {
    return [
      { id: 'spectral', type: 'spectral', label: 'Spectral Analysis', score: m ? 80 + (hash % 14) : inc ? 50 + (hash % 18) : 5 + (hash % 7), direction: dirM, reliability: 'high', activated: true,
        explanation: m ? 'Spectral anomalies consistent with synthesis artifacts.' : 'Spectral profile is natural.' },
      { id: 'temporal_audio', type: 'temporal', label: 'Temporal Analysis', score: m ? 75 + (hash % 12) : inc ? 45 + (hash % 20) : 4 + (hash % 6), direction: dirM, reliability: 'moderate', activated: true,
        explanation: m ? 'Temporal discontinuities detected in waveform.' : 'Temporal flow is natural.' },
      { id: 'voice', type: 'voice', label: 'Voice Characteristics', score: m ? 85 + (hash % 10) : inc ? 55 + (hash % 15) : 6 + (hash % 8), direction: dirM, reliability: 'high', activated: true,
        explanation: m ? 'Prosodic characteristics suggest synthetic generation.' : 'Voice characteristics are natural.' },
      { id: 'synthesis', type: 'synthesis', label: 'Synthesis Indicators', score: m ? 78 + (hash % 12) : inc ? 48 + (hash % 16) : 3 + (hash % 5), direction: m ? 'supporting' : inc ? 'inconclusive' : 'contradicting', reliability: 'moderate', activated: true,
        explanation: m ? 'TTS/voice-cloning artifacts detected.' : 'No synthesis artifacts detected.' },
      { id: 'compression_audio', type: 'compression', label: 'Compression', score: m ? 55 + (hash % 15) : 8 + (hash % 10), direction: m ? 'inconclusive' : 'contradicting', reliability: 'moderate', activated: true,
        explanation: 'Audio compression characteristics analyzed.' },
    ];
  }

  return [];
}

function generateDemoRelationships(signals, verdict) {
  const relationships = [];
  for (let i = 0; i < signals.length; i++) {
    for (let j = i + 1; j < signals.length; j++) {
      const a = signals[i], b = signals[j];
      let agreement;
      if (a.direction === b.direction && a.direction !== 'inconclusive') agreement = '+';
      else if (a.direction === 'inconclusive' || b.direction === 'inconclusive') agreement = '?';
      else if (a.direction !== b.direction) agreement = '×';
      else agreement = '?';
      relationships.push({ signalA: a.id, signalB: b.id, agreement });
    }
  }
  return relationships;
}

function generateDemoStability(baseScore, hash) {
  return [
    { transformation: 'original', label: 'Original', score: baseScore, status: 'stable' },
    { transformation: 'jpeg', label: 'JPEG', score: baseScore - 1 - (hash % 3), status: 'stable' },
    { transformation: 'resize', label: 'Resize', score: baseScore - 2 - (hash % 3), status: 'stable' },
    { transformation: 'crop', label: 'Crop', score: baseScore - 3 - (hash % 5), status: baseScore > 70 ? 'stable' : 'changed' },
    { transformation: 're-encode', label: 'Re-encode', score: baseScore - 4 - (hash % 5), status: baseScore > 70 ? 'stable' : 'changed' },
  ];
}

function generateDemoSegments(mediaType, verdict, hash) {
  if (verdict !== 'manipulated') return [];
  if (mediaType === 'video') {
    return [
      { signalType: 'visual', label: 'Visual anomaly', startTime: 1.2 + (hash % 10) / 10, endTime: 3.8 + (hash % 10) / 10, severity: 0.8 },
      { signalType: 'temporal', label: 'Temporal discontinuity', startTime: 2.0, endTime: 4.5, severity: 0.9 },
      { signalType: 'face', label: 'Face manipulation', startTime: 1.5, endTime: 5.2, severity: 0.85 },
      { signalType: 'audio', label: 'Audio splice', startTime: 2.8, endTime: 3.6, severity: 0.6 },
      { signalType: 'lip_sync', label: 'Lip-sync mismatch', startTime: 2.4, endTime: 4.8, severity: 0.75 },
    ];
  }
  if (mediaType === 'audio') {
    return [
      { signalType: 'audio', label: 'Spectral anomaly', startTime: 0.5, endTime: 2.1, severity: 0.7 },
      { signalType: 'audio', label: 'Temporal discontinuity', startTime: 3.2, endTime: 4.8, severity: 0.8 },
    ];
  }
  return [];
}

function generateDemoCrossModal(verdict, hash) {
  if (verdict !== 'manipulated') return { syncOffset: 0, isConsistent: true, description: 'Audio-visual synchronization is consistent.' };
  return {
    syncOffset: 0.12 + (hash % 30) / 100,
    isConsistent: false,
    description: 'Audio-visual timing offset detected. Lip movements do not align with speech phonemes.',
    expectedRanges: [{ start: 1.0, end: 3.5 }, { start: 5.0, end: 7.2 }],
    observedRanges: [{ start: 1.15, end: 3.65 }, { start: 5.2, end: 7.5 }],
  };
}

function generateDemoExplanations(mediaType, verdict, hash) {
  if (verdict === 'manipulated') {
    if (mediaType === 'video') {
      return [
        { rank: 1, title: 'Face manipulation detected', strength: 'strong', direction: 'supporting', description: 'Facial geometry anomalies concentrated around jaw and mouth regions.' },
        { rank: 2, title: 'Temporal inconsistency', strength: 'strong', direction: 'supporting', description: 'Frame-to-frame motion vectors show discontinuities at suspected splice points.' },
        { rank: 3, title: 'Lip-sync mismatch', strength: 'strong', direction: 'supporting', description: 'Audio phoneme timing does not match lip articulation pattern.' },
        { rank: 4, title: 'Audio spectral anomaly', strength: 'moderate', direction: 'supporting', description: 'Spectral characteristics in voice segments are inconsistent with natural speech.' },
      ];
    }
    if (mediaType === 'audio') {
      return [
        { rank: 1, title: 'Synthesis artifacts detected', strength: 'strong', direction: 'supporting', description: 'Spectral patterns consistent with TTS or voice-cloning systems.' },
        { rank: 2, title: 'Prosodic anomalies', strength: 'strong', direction: 'supporting', description: 'Pitch contour and rhythm patterns deviate from natural speech.' },
        { rank: 3, title: 'Temporal discontinuity', strength: 'moderate', direction: 'supporting', description: 'Waveform shows segment boundaries with unnatural transitions.' },
      ];
    }
    return [
      { rank: 1, title: 'Visual integrity anomaly', strength: 'strong', direction: 'supporting', description: 'High-frequency residual analysis detected abnormal texture distribution.' },
      { rank: 2, title: 'Frequency-domain artifact', strength: 'strong', direction: 'supporting', description: 'Spectral analysis reveals inconsistencies in frequency components.' },
      { rank: 3, title: 'Noise pattern discontinuity', strength: 'moderate', direction: 'supporting', description: 'Sensor noise profile varies across image regions.' },
    ];
  }
  if (verdict === 'inconclusive') {
    return [
      { rank: 1, title: 'Contradictory evidence', strength: 'moderate', direction: 'inconclusive', description: 'Forensic signals do not converge toward a single hypothesis.' },
      { rank: 2, title: 'Low confidence signals', strength: 'weak', direction: 'inconclusive', description: 'Insufficient discriminative evidence for definitive determination.' },
    ];
  }
  // Authentic
  if (mediaType === 'video') {
    return [
      { rank: 1, title: 'Consistent frame integrity', strength: 'strong', direction: 'contradicting', description: 'All analyzed keyframes show consistent visual characteristics.' },
      { rank: 2, title: 'Natural temporal flow', strength: 'strong', direction: 'contradicting', description: 'Motion vectors and inter-frame transitions are natural.' },
      { rank: 3, title: 'Lip-sync consistent', strength: 'moderate', direction: 'contradicting', description: 'Audio phonemes align with lip articulation.' },
    ];
  }
  if (mediaType === 'audio') {
    return [
      { rank: 1, title: 'Natural voice characteristics', strength: 'strong', direction: 'contradicting', description: 'Voice prosody and formant structure are consistent with natural speech.' },
      { rank: 2, title: 'No synthesis indicators', strength: 'moderate', direction: 'contradicting', description: 'No TTS or voice-cloning artifacts detected.' },
    ];
  }
  return [
    { rank: 1, title: 'Consistent visual integrity', strength: 'strong', direction: 'contradicting', description: 'No manipulation artifacts found in any analyzed region.' },
    { rank: 2, title: 'Metadata coherent', strength: 'moderate', direction: 'contradicting', description: 'Metadata is internally consistent with single-capture workflow.' },
  ];
}

function generateInvestigationFlow() {
  const stages = [
    'media_detected', 'modality_identified', 'tests_selected',
    'evidence_collected', 'contradiction_check', 'localization',
    'stability_test', 'final_verdict',
  ];
  return stages.map((stage, i) => ({
    stage, status: 'completed', timestamp: Date.now() - (stages.length - i) * 200,
  }));
}

// ─── Utility ────────────────────────────────────────────────────
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function generateHexHash(input) {
  const h = simpleHash(input || 'unknown');
  let hex = '';
  for (let i = 0; i < 64; i++) hex += '0123456789abcdef'[(h * (i + 1) * 7) % 16];
  return hex;
}

// ─── State Management ───────────────────────────────────────────
async function getState(tabId) {
  const key = `${STORAGE_KEY}_${tabId}`;
  const data = await chrome.storage.local.get(key);
  return data[key] || { status: 'idle', media: [], results: {} };
}

async function updateState(tabId, updates) {
  const key = `${STORAGE_KEY}_${tabId}`;
  const current = await getState(tabId);
  const newState = { ...current, ...updates };
  await chrome.storage.local.set({ [key]: newState });
  // Notify side panel
  try {
    await chrome.runtime.sendMessage({ action: 'stateUpdate', tabId, state: newState });
  } catch (e) {
    // Side panel may not be open
  }
}

async function clearState(tabId) {
  const key = `${STORAGE_KEY}_${tabId}`;
  await chrome.storage.local.remove(key);
  return { success: true };
}

function handleMediaFromContent(media, tabId) {
  return updateState(tabId, { media, totalMedia: media?.length || 0 });
}

async function handleBadgeClick(mediaId, tabId) {
  try {
    await chrome.sidePanel.open({ tabId });
    // Small delay to let panel open
    setTimeout(() => {
      chrome.runtime.sendMessage({ action: 'focusMedia', mediaId, tabId });
    }, 300);
  } catch (e) {
    console.warn('FORENSIGHT: Could not open side panel on badge click');
  }
  return { success: true };
}
