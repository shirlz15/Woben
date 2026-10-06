/**
 * FORENSIGHT — Demo Data Factory
 * 
 * Generates clearly-labeled demo analysis results for hackathon presentation.
 * Every demo result has isDemo: true.
 * 
 * These are NOT production outputs. They simulate what the backend would produce
 * so the UI can be demonstrated with realistic data.
 */

import {
  VerdictStatus,
  MediaType,
  SignalType,
  EvidenceDirection,
  StabilityStatus,
  InvestigationStage,
} from './forensic-data.js';

// ─── Helper ─────────────────────────────────────────────────────
function generateId() {
  return 'FS-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

function demoHash() {
  const chars = '0123456789abcdef';
  let hash = '';
  for (let i = 0; i < 64; i++) hash += chars[Math.floor(Math.random() * 16)];
  return hash;
}


// ─── CASE 01: AUTHENTIC IMAGE ───────────────────────────────────

export function createAuthenticImageDemo() {
  return {
    id: generateId(),
    mediaHash: demoHash(),
    mediaType: MediaType.IMAGE,
    mediaUrl: null,
    fileName: 'photo_original.jpg',
    analysisTimeMs: 1840,
    timestamp: new Date(),

    verdictStatus: VerdictStatus.AUTHENTIC,
    verdictScore: 6,
    evidenceConfidence: 'high',
    verdictLabel: 'Authenticity Likely',

    signals: [
      {
        id: 'visual',
        type: SignalType.VISUAL,
        label: 'Visual Integrity',
        score: 4,
        direction: EvidenceDirection.SUPPORTING,
        reliability: 'high',
        explanation: 'No detectable visual artifacts or manipulation signatures found in pixel-level analysis.',
        activated: true,
      },
      {
        id: 'frequency',
        type: SignalType.FREQUENCY,
        label: 'Frequency Analysis',
        score: 7,
        direction: EvidenceDirection.SUPPORTING,
        reliability: 'high',
        explanation: 'Frequency spectrum is consistent with a single-capture image. No splicing artifacts detected.',
        activated: true,
      },
      {
        id: 'metadata',
        type: SignalType.METADATA,
        label: 'Metadata',
        score: 3,
        direction: EvidenceDirection.SUPPORTING,
        reliability: 'moderate',
        explanation: 'EXIF data is internally consistent. Camera model, timestamp, and GPS data are coherent.',
        activated: true,
      },
      {
        id: 'compression',
        type: SignalType.COMPRESSION,
        label: 'Compression',
        score: null,
        direction: EvidenceDirection.SUPPORTING,
        reliability: 'moderate',
        explanation: 'JPEG quantization tables are consistent with a single compression pass.',
        activated: true,
      },
      {
        id: 'face',
        type: SignalType.FACE,
        label: 'Face Analysis',
        score: 8,
        direction: EvidenceDirection.SUPPORTING,
        reliability: 'high',
        explanation: 'Facial features show natural consistency. No GAN artifacts or blending boundaries detected.',
        activated: true,
      },
      {
        id: 'audio',
        type: SignalType.AUDIO,
        label: 'Audio Forensics',
        score: null,
        direction: EvidenceDirection.UNAVAILABLE,
        reliability: 'unknown',
        explanation: 'Not applicable for image media.',
        activated: false,
      },
      {
        id: 'lip_sync',
        type: SignalType.LIP_SYNC,
        label: 'Lip-Sync',
        score: null,
        direction: EvidenceDirection.UNAVAILABLE,
        reliability: 'unknown',
        explanation: 'Not applicable for image media.',
        activated: false,
      },
      {
        id: 'temporal',
        type: SignalType.TEMPORAL,
        label: 'Temporal Consistency',
        score: null,
        direction: EvidenceDirection.UNAVAILABLE,
        reliability: 'unknown',
        explanation: 'Not applicable for image media.',
        activated: false,
      },
    ],

    relationships: [
      { signalA: 'visual', signalB: 'frequency', agreement: '+' },
      { signalA: 'visual', signalB: 'metadata', agreement: '+' },
      { signalA: 'visual', signalB: 'compression', agreement: '+' },
      { signalA: 'visual', signalB: 'face', agreement: '+' },
      { signalA: 'frequency', signalB: 'metadata', agreement: '+' },
      { signalA: 'frequency', signalB: 'compression', agreement: '+' },
      { signalA: 'frequency', signalB: 'face', agreement: '+' },
      { signalA: 'metadata', signalB: 'compression', agreement: '+' },
      { signalA: 'metadata', signalB: 'face', agreement: '+' },
      { signalA: 'compression', signalB: 'face', agreement: '+' },
    ],

    stabilityResults: [
      { transformation: 'original', label: 'Original', score: 6, status: StabilityStatus.STABLE },
      { transformation: 'jpeg', label: 'JPEG', score: 7, status: StabilityStatus.STABLE },
      { transformation: 'resize', label: 'Resize', score: 6, status: StabilityStatus.STABLE },
      { transformation: 'crop', label: 'Crop', score: 8, status: StabilityStatus.STABLE },
      { transformation: 're-encode', label: 'Re-encode', score: 7, status: StabilityStatus.STABLE },
    ],

    suspiciousRegions: [],
    suspiciousSegments: [],
    crossModalSync: null,

    explanations: [
      { rank: 1, title: 'Visual integrity consistent', strength: 'strong', direction: EvidenceDirection.SUPPORTING, description: 'No manipulation artifacts detected in pixel analysis.' },
      { rank: 2, title: 'Frequency analysis clean', strength: 'strong', direction: EvidenceDirection.SUPPORTING, description: 'Spectrum consistent with single-capture image.' },
      { rank: 3, title: 'Natural facial features', strength: 'strong', direction: EvidenceDirection.SUPPORTING, description: 'No GAN artifacts or boundary inconsistencies.' },
      { rank: 4, title: 'Metadata coherent', strength: 'moderate', direction: EvidenceDirection.SUPPORTING, description: 'EXIF data internally consistent.' },
      { rank: 5, title: 'Compression normal', strength: 'moderate', direction: EvidenceDirection.SUPPORTING, description: 'Single compression pass detected.' },
    ],

    explanationSummary: 'All independent signals are consistent with an authentic, unmanipulated image. No forensic evidence of tampering was detected.',

    investigationFlow: [
      { stage: InvestigationStage.MEDIA_DETECTED, status: 'completed', timestamp: Date.now() - 1840 },
      { stage: InvestigationStage.MODALITY_IDENTIFIED, status: 'completed', timestamp: Date.now() - 1720 },
      { stage: InvestigationStage.TESTS_SELECTED, status: 'completed', timestamp: Date.now() - 1600 },
      { stage: InvestigationStage.EVIDENCE_COLLECTED, status: 'completed', timestamp: Date.now() - 800 },
      { stage: InvestigationStage.CONTRADICTION_CHECK, status: 'completed', timestamp: Date.now() - 400 },
      { stage: InvestigationStage.LOCALIZATION, status: 'completed', timestamp: Date.now() - 200 },
      { stage: InvestigationStage.STABILITY_TEST, status: 'completed', timestamp: Date.now() - 100 },
      { stage: InvestigationStage.FINAL_VERDICT, status: 'completed', timestamp: Date.now() },
    ],

    activatedModules: ['Visual Artifacts', 'Frequency Analysis', 'Metadata', 'Compression', 'Face Analysis'],
    skippedModules: ['Audio', 'Lip-Sync', 'Temporal Analysis'],
    contentDetected: 'Face',
    isDemo: true,
  };
}


// ─── CASE 02: MANIPULATED VIDEO (DEEPFAKE) ─────────────────────

export function createManipulatedVideoDemo() {
  return {
    id: generateId(),
    mediaHash: demoHash(),
    mediaType: MediaType.VIDEO,
    mediaUrl: null,
    fileName: 'interview_clip.mp4',
    analysisTimeMs: 4260,
    timestamp: new Date(),

    verdictStatus: VerdictStatus.MANIPULATED,
    verdictScore: 91,
    evidenceConfidence: 'high',
    verdictLabel: 'Manipulation Likely',

    signals: [
      {
        id: 'visual',
        type: SignalType.VISUAL,
        label: 'Visual Integrity',
        score: 89,
        direction: EvidenceDirection.SUPPORTING,
        reliability: 'high',
        explanation: 'Detectable blending boundaries around facial region. GAN-consistent texture artifacts in skin rendering.',
        activated: true,
      },
      {
        id: 'temporal',
        type: SignalType.TEMPORAL,
        label: 'Temporal Consistency',
        score: 92,
        direction: EvidenceDirection.SUPPORTING,
        reliability: 'high',
        explanation: 'Inter-frame facial geometry shows unnatural jitter inconsistent with natural head movement.',
        activated: true,
      },
      {
        id: 'audio',
        type: SignalType.AUDIO,
        label: 'Audio Forensics',
        score: 86,
        direction: EvidenceDirection.SUPPORTING,
        reliability: 'moderate',
        explanation: 'Spectral analysis reveals subtle vocoder artifacts in speech segments between 00:14–00:17.',
        activated: true,
      },
      {
        id: 'lip_sync',
        type: SignalType.LIP_SYNC,
        label: 'Lip-Sync',
        score: 94,
        direction: EvidenceDirection.SUPPORTING,
        reliability: 'high',
        explanation: 'Lip movements do not match phoneme expectations for the detected speech content.',
        activated: true,
      },
      {
        id: 'metadata',
        type: SignalType.METADATA,
        label: 'Metadata',
        score: 61,
        direction: EvidenceDirection.INCONCLUSIVE,
        reliability: 'low',
        explanation: 'Metadata has been partially stripped. Encoding parameters suggest re-processing but are not conclusive.',
        activated: true,
      },
      {
        id: 'compression',
        type: SignalType.COMPRESSION,
        label: 'Compression',
        score: null,
        direction: EvidenceDirection.SUPPORTING,
        reliability: 'moderate',
        explanation: 'Double compression detected. Quantization inconsistencies suggest the video was re-encoded.',
        activated: true,
      },
      {
        id: 'face',
        type: SignalType.FACE,
        label: 'Face Analysis',
        score: 90,
        direction: EvidenceDirection.SUPPORTING,
        reliability: 'high',
        explanation: 'Facial landmark tracking reveals non-physiological movements and boundary artifacts.',
        activated: true,
      },
    ],

    relationships: [
      { signalA: 'visual', signalB: 'temporal', agreement: '+' },
      { signalA: 'visual', signalB: 'audio', agreement: '+' },
      { signalA: 'visual', signalB: 'lip_sync', agreement: '+' },
      { signalA: 'visual', signalB: 'metadata', agreement: '?' },
      { signalA: 'visual', signalB: 'compression', agreement: '+' },
      { signalA: 'visual', signalB: 'face', agreement: '+' },
      { signalA: 'temporal', signalB: 'audio', agreement: '+' },
      { signalA: 'temporal', signalB: 'lip_sync', agreement: '+' },
      { signalA: 'temporal', signalB: 'metadata', agreement: '?' },
      { signalA: 'temporal', signalB: 'compression', agreement: '+' },
      { signalA: 'temporal', signalB: 'face', agreement: '+' },
      { signalA: 'audio', signalB: 'lip_sync', agreement: '+' },
      { signalA: 'audio', signalB: 'metadata', agreement: '?' },
      { signalA: 'audio', signalB: 'compression', agreement: '+' },
      { signalA: 'audio', signalB: 'face', agreement: '+' },
      { signalA: 'lip_sync', signalB: 'metadata', agreement: '?' },
      { signalA: 'lip_sync', signalB: 'compression', agreement: '+' },
      { signalA: 'lip_sync', signalB: 'face', agreement: '+' },
      { signalA: 'metadata', signalB: 'compression', agreement: '?' },
      { signalA: 'metadata', signalB: 'face', agreement: '?' },
      { signalA: 'compression', signalB: 'face', agreement: '+' },
    ],

    stabilityResults: [
      { transformation: 'original', label: 'Original', score: 91, status: StabilityStatus.STABLE },
      { transformation: 'jpeg', label: 'JPEG', score: 89, status: StabilityStatus.STABLE },
      { transformation: 'resize', label: 'Resize', score: 90, status: StabilityStatus.STABLE },
      { transformation: 'crop', label: 'Crop', score: 87, status: StabilityStatus.STABLE },
      { transformation: 're-encode', label: 'Re-encode', score: 88, status: StabilityStatus.STABLE },
    ],

    suspiciousRegions: [
      { x: 0.30, y: 0.15, width: 0.40, height: 0.50, intensity: 0.88 },
      { x: 0.35, y: 0.55, width: 0.30, height: 0.15, intensity: 0.72 },
    ],

    suspiciousSegments: [
      { startTime: 14.2, endTime: 16.8, signalType: SignalType.VISUAL, severity: 0.91, label: 'Visual manipulation detected' },
      { startTime: 13.8, endTime: 17.1, signalType: SignalType.AUDIO, severity: 0.86, label: 'Audio anomaly detected' },
      { startTime: 14.0, endTime: 17.0, signalType: SignalType.LIP_SYNC, severity: 0.94, label: 'Lip-sync mismatch' },
      { startTime: 14.1, endTime: 16.9, signalType: SignalType.TEMPORAL, severity: 0.92, label: 'Temporal inconsistency' },
    ],

    crossModalSync: {
      syncOffset: 0.42,
      isConsistent: false,
      description: 'Audio-visual synchronization offset of +0.42 seconds detected in suspicious segment. Lip movements precede corresponding audio.',
      expectedRanges: [{ start: 14.0, end: 17.0 }],
      observedRanges: [{ start: 14.42, end: 17.42 }],
    },

    explanations: [
      { rank: 1, title: 'Lip-sync inconsistency', strength: 'strong', direction: EvidenceDirection.SUPPORTING, description: 'Lip movements do not match the phoneme sequence of detected speech. This is a strong indicator of face-swap or re-enactment manipulation.' },
      { rank: 2, title: 'Temporal facial inconsistency', strength: 'strong', direction: EvidenceDirection.SUPPORTING, description: 'Frame-to-frame facial geometry shows unnatural micro-jitter that is inconsistent with physiological head movement.' },
      { rank: 3, title: 'Facial boundary artifacts', strength: 'strong', direction: EvidenceDirection.SUPPORTING, description: 'Detectable blending boundaries around the facial region are consistent with face-swap techniques.' },
      { rank: 4, title: 'Audio spectral anomaly', strength: 'moderate', direction: EvidenceDirection.SUPPORTING, description: 'Subtle vocoder artifacts detected in speech segments, suggesting audio may have been synthesized or modified.' },
      { rank: 5, title: 'Metadata inconclusive', strength: 'none', direction: EvidenceDirection.INCONCLUSIVE, description: 'Metadata has been partially stripped. Cannot determine original source from available metadata.' },
      { rank: 6, title: 'Double compression', strength: 'moderate', direction: EvidenceDirection.SUPPORTING, description: 'Video shows signs of re-encoding, consistent with post-processing after manipulation.' },
    ],

    explanationSummary: 'Multiple independent signals strongly support manipulation. The strongest evidence comes from lip-sync mismatch and temporal facial inconsistencies. Audio analysis provides moderate corroboration. Metadata is inconclusive due to stripping.',

    investigationFlow: [
      { stage: InvestigationStage.MEDIA_DETECTED, status: 'completed', timestamp: Date.now() - 4260 },
      { stage: InvestigationStage.MODALITY_IDENTIFIED, status: 'completed', timestamp: Date.now() - 4100 },
      { stage: InvestigationStage.TESTS_SELECTED, status: 'completed', timestamp: Date.now() - 3900 },
      { stage: InvestigationStage.EVIDENCE_COLLECTED, status: 'completed', timestamp: Date.now() - 2000 },
      { stage: InvestigationStage.CONTRADICTION_CHECK, status: 'completed', timestamp: Date.now() - 1000 },
      { stage: InvestigationStage.LOCALIZATION, status: 'completed', timestamp: Date.now() - 500 },
      { stage: InvestigationStage.STABILITY_TEST, status: 'completed', timestamp: Date.now() - 200 },
      { stage: InvestigationStage.FINAL_VERDICT, status: 'completed', timestamp: Date.now() },
    ],

    activatedModules: ['Visual Artifacts', 'Temporal Analysis', 'Audio Forensics', 'Lip-Sync Analysis', 'Metadata', 'Compression', 'Face Analysis'],
    skippedModules: [],
    contentDetected: 'Face + Speech',
    isDemo: true,
  };
}


// ─── CASE 03: INCONCLUSIVE ──────────────────────────────────────

export function createInconclusiveDemo() {
  return {
    id: generateId(),
    mediaHash: demoHash(),
    mediaType: MediaType.IMAGE,
    mediaUrl: null,
    fileName: 'document_scan.png',
    analysisTimeMs: 2100,
    timestamp: new Date(),

    verdictStatus: VerdictStatus.INCONCLUSIVE,
    verdictScore: 58,
    evidenceConfidence: 'low',
    verdictLabel: 'Inconclusive',

    signals: [
      {
        id: 'visual',
        type: SignalType.VISUAL,
        label: 'Visual Integrity',
        score: 67,
        direction: EvidenceDirection.SUPPORTING,
        reliability: 'moderate',
        explanation: 'Some visual inconsistencies detected near text regions, but within ambiguous range.',
        activated: true,
      },
      {
        id: 'frequency',
        type: SignalType.FREQUENCY,
        label: 'Frequency Analysis',
        score: 42,
        direction: EvidenceDirection.CONTRADICTING,
        reliability: 'moderate',
        explanation: 'Frequency spectrum shows characteristics of a single-source image, contradicting visual signal.',
        activated: true,
      },
      {
        id: 'metadata',
        type: SignalType.METADATA,
        label: 'Metadata',
        score: 35,
        direction: EvidenceDirection.INCONCLUSIVE,
        reliability: 'low',
        explanation: 'Metadata is minimal. Image appears to be a screenshot or re-saved scan.',
        activated: true,
      },
      {
        id: 'compression',
        type: SignalType.COMPRESSION,
        label: 'Compression',
        score: null,
        direction: EvidenceDirection.SUPPORTING,
        reliability: 'low',
        explanation: 'PNG format — lossless compression, limited forensic insight from compression analysis.',
        activated: true,
      },
      {
        id: 'text',
        type: SignalType.TEXT,
        label: 'Text/Document',
        score: 55,
        direction: EvidenceDirection.INCONCLUSIVE,
        reliability: 'low',
        explanation: 'OCR detected text regions. Layout analysis is inconclusive — could be normal formatting variation.',
        activated: true,
      },
    ],

    relationships: [
      { signalA: 'visual', signalB: 'frequency', agreement: '×' },
      { signalA: 'visual', signalB: 'metadata', agreement: '?' },
      { signalA: 'visual', signalB: 'compression', agreement: '?' },
      { signalA: 'visual', signalB: 'text', agreement: '?' },
      { signalA: 'frequency', signalB: 'metadata', agreement: '?' },
      { signalA: 'frequency', signalB: 'compression', agreement: '?' },
      { signalA: 'frequency', signalB: 'text', agreement: '?' },
      { signalA: 'metadata', signalB: 'compression', agreement: '?' },
      { signalA: 'metadata', signalB: 'text', agreement: '?' },
      { signalA: 'compression', signalB: 'text', agreement: '?' },
    ],

    stabilityResults: [
      { transformation: 'original', label: 'Original', score: 58, status: StabilityStatus.STABLE },
      { transformation: 'jpeg', label: 'JPEG', score: 52, status: StabilityStatus.CHANGED },
      { transformation: 'resize', label: 'Resize', score: 61, status: StabilityStatus.CHANGED },
      { transformation: 'crop', label: 'Crop', score: 45, status: StabilityStatus.CHANGED },
      { transformation: 're-encode', label: 'Re-encode', score: 50, status: StabilityStatus.CHANGED },
    ],

    suspiciousRegions: [
      { x: 0.10, y: 0.30, width: 0.80, height: 0.15, intensity: 0.45 },
    ],

    suspiciousSegments: [],
    crossModalSync: null,

    explanations: [
      { rank: 1, title: 'Visual inconsistency near text', strength: 'moderate', direction: EvidenceDirection.SUPPORTING, description: 'Some pixel-level anomalies detected near text regions, but within ambiguous range.' },
      { rank: 2, title: 'Frequency analysis contradicts', strength: 'moderate', direction: EvidenceDirection.CONTRADICTING, description: 'Frequency spectrum does not support manipulation hypothesis.' },
      { rank: 3, title: 'Document layout ambiguous', strength: 'weak', direction: EvidenceDirection.INCONCLUSIVE, description: 'Layout characteristics could be normal formatting variation.' },
      { rank: 4, title: 'Metadata insufficient', strength: 'none', direction: EvidenceDirection.INCONCLUSIVE, description: 'Not enough metadata to assess provenance.' },
      { rank: 5, title: 'Compression uninformative', strength: 'none', direction: EvidenceDirection.INCONCLUSIVE, description: 'Lossless PNG — limited forensic signal from compression.' },
    ],

    explanationSummary: 'Evidence is contradictory. Visual analysis suggests possible manipulation near text regions, but frequency analysis does not corroborate this. Metadata and compression provide insufficient evidence. Manual verification is recommended.',

    investigationFlow: [
      { stage: InvestigationStage.MEDIA_DETECTED, status: 'completed', timestamp: Date.now() - 2100 },
      { stage: InvestigationStage.MODALITY_IDENTIFIED, status: 'completed', timestamp: Date.now() - 2000 },
      { stage: InvestigationStage.TESTS_SELECTED, status: 'completed', timestamp: Date.now() - 1900 },
      { stage: InvestigationStage.EVIDENCE_COLLECTED, status: 'completed', timestamp: Date.now() - 1000 },
      { stage: InvestigationStage.CONTRADICTION_CHECK, status: 'completed', timestamp: Date.now() - 600 },
      { stage: InvestigationStage.LOCALIZATION, status: 'completed', timestamp: Date.now() - 300 },
      { stage: InvestigationStage.STABILITY_TEST, status: 'completed', timestamp: Date.now() - 100 },
      { stage: InvestigationStage.FINAL_VERDICT, status: 'completed', timestamp: Date.now() },
    ],

    activatedModules: ['Visual Artifacts', 'Frequency Analysis', 'Metadata', 'Compression', 'Text/Document Analysis'],
    skippedModules: ['Audio', 'Lip-Sync', 'Temporal Analysis', 'Face Analysis'],
    contentDetected: 'Text + Layout',
    isDemo: true,
  };
}


// ─── CASE 04: COMPRESSED / RE-ENCODED ───────────────────────────

export function createCompressedReencodedDemo() {
  return {
    id: generateId(),
    mediaHash: demoHash(),
    mediaType: MediaType.VIDEO,
    mediaUrl: null,
    fileName: 'social_repost.mp4',
    analysisTimeMs: 3400,
    timestamp: new Date(),

    verdictStatus: VerdictStatus.MANIPULATED,
    verdictScore: 78,
    evidenceConfidence: 'moderate',
    verdictLabel: 'Manipulation Likely',

    signals: [
      {
        id: 'visual',
        type: SignalType.VISUAL,
        label: 'Visual Integrity',
        score: 74,
        direction: EvidenceDirection.SUPPORTING,
        reliability: 'moderate',
        explanation: 'Visual artifacts detected but partially obscured by heavy compression. Face-swap indicators present but degraded.',
        activated: true,
      },
      {
        id: 'temporal',
        type: SignalType.TEMPORAL,
        label: 'Temporal Consistency',
        score: 81,
        direction: EvidenceDirection.SUPPORTING,
        reliability: 'moderate',
        explanation: 'Temporal inconsistencies present despite compression. Motion vectors show irregular patterns.',
        activated: true,
      },
      {
        id: 'audio',
        type: SignalType.AUDIO,
        label: 'Audio Forensics',
        score: 62,
        direction: EvidenceDirection.INCONCLUSIVE,
        reliability: 'low',
        explanation: 'Audio quality severely degraded by compression. Some anomalies detected but confidence is low.',
        activated: true,
      },
      {
        id: 'lip_sync',
        type: SignalType.LIP_SYNC,
        label: 'Lip-Sync',
        score: 79,
        direction: EvidenceDirection.SUPPORTING,
        reliability: 'moderate',
        explanation: 'Lip-sync analysis partially affected by low resolution, but measurable desync detected.',
        activated: true,
      },
      {
        id: 'metadata',
        type: SignalType.METADATA,
        label: 'Metadata',
        score: 45,
        direction: EvidenceDirection.INCONCLUSIVE,
        reliability: 'low',
        explanation: 'Metadata indicates multiple re-encoding passes. Original source metadata is absent.',
        activated: true,
      },
      {
        id: 'compression',
        type: SignalType.COMPRESSION,
        label: 'Compression',
        score: null,
        direction: EvidenceDirection.INCONCLUSIVE,
        reliability: 'low',
        explanation: 'Multiple compression generations detected. Forensic signals are degraded by heavy re-encoding.',
        activated: true,
      },
    ],

    relationships: [
      { signalA: 'visual', signalB: 'temporal', agreement: '+' },
      { signalA: 'visual', signalB: 'audio', agreement: '?' },
      { signalA: 'visual', signalB: 'lip_sync', agreement: '+' },
      { signalA: 'visual', signalB: 'metadata', agreement: '?' },
      { signalA: 'visual', signalB: 'compression', agreement: '?' },
      { signalA: 'temporal', signalB: 'audio', agreement: '?' },
      { signalA: 'temporal', signalB: 'lip_sync', agreement: '+' },
      { signalA: 'temporal', signalB: 'metadata', agreement: '?' },
      { signalA: 'temporal', signalB: 'compression', agreement: '?' },
      { signalA: 'audio', signalB: 'lip_sync', agreement: '?' },
      { signalA: 'audio', signalB: 'metadata', agreement: '?' },
      { signalA: 'audio', signalB: 'compression', agreement: '?' },
      { signalA: 'lip_sync', signalB: 'metadata', agreement: '?' },
      { signalA: 'lip_sync', signalB: 'compression', agreement: '?' },
      { signalA: 'metadata', signalB: 'compression', agreement: '+' },
    ],

    stabilityResults: [
      { transformation: 'original', label: 'Original', score: 78, status: StabilityStatus.STABLE },
      { transformation: 'jpeg', label: 'JPEG', score: 72, status: StabilityStatus.CHANGED },
      { transformation: 'resize', label: 'Resize', score: 68, status: StabilityStatus.CHANGED },
      { transformation: 'crop', label: 'Crop', score: 61, status: StabilityStatus.UNSTABLE },
      { transformation: 're-encode', label: 'Re-encode', score: 55, status: StabilityStatus.UNSTABLE },
    ],

    suspiciousRegions: [
      { x: 0.28, y: 0.12, width: 0.44, height: 0.55, intensity: 0.74 },
    ],

    suspiciousSegments: [
      { startTime: 3.1, endTime: 8.4, signalType: SignalType.VISUAL, severity: 0.74, label: 'Visual artifacts in face region' },
      { startTime: 2.8, endTime: 8.8, signalType: SignalType.TEMPORAL, severity: 0.81, label: 'Temporal jitter detected' },
      { startTime: 4.0, endTime: 7.5, signalType: SignalType.LIP_SYNC, severity: 0.79, label: 'Lip-sync desynchronization' },
    ],

    crossModalSync: {
      syncOffset: 0.18,
      isConsistent: false,
      description: 'Minor audio-visual desynchronization detected (+0.18s). Partially attributable to compression artifacts.',
      expectedRanges: [{ start: 3.0, end: 8.0 }],
      observedRanges: [{ start: 3.18, end: 8.18 }],
    },

    explanations: [
      { rank: 1, title: 'Temporal motion irregularity', strength: 'moderate', direction: EvidenceDirection.SUPPORTING, description: 'Motion vectors show irregular patterns consistent with face-swap processing, despite compression degradation.' },
      { rank: 2, title: 'Lip-sync desynchronization', strength: 'moderate', direction: EvidenceDirection.SUPPORTING, description: 'Measurable lip-audio desync detected even at reduced resolution.' },
      { rank: 3, title: 'Visual face-swap indicators', strength: 'moderate', direction: EvidenceDirection.SUPPORTING, description: 'Face-swap artifacts present but partially masked by heavy compression.' },
      { rank: 4, title: 'Audio analysis limited', strength: 'weak', direction: EvidenceDirection.INCONCLUSIVE, description: 'Audio quality too degraded for reliable forensic analysis.' },
      { rank: 5, title: 'Heavy re-encoding detected', strength: 'moderate', direction: EvidenceDirection.INCONCLUSIVE, description: 'Multiple compression generations reduce overall forensic confidence.' },
    ],

    explanationSummary: 'Manipulation indicators detected despite heavy compression and re-encoding. Temporal and lip-sync evidence provide the strongest signals. Audio analysis is limited by quality degradation. Overall evidence confidence is moderate due to compression artifacts. Forensic stability is reduced — verdict may change under further transformation.',

    investigationFlow: [
      { stage: InvestigationStage.MEDIA_DETECTED, status: 'completed', timestamp: Date.now() - 3400 },
      { stage: InvestigationStage.MODALITY_IDENTIFIED, status: 'completed', timestamp: Date.now() - 3300 },
      { stage: InvestigationStage.TESTS_SELECTED, status: 'completed', timestamp: Date.now() - 3100 },
      { stage: InvestigationStage.EVIDENCE_COLLECTED, status: 'completed', timestamp: Date.now() - 1500 },
      { stage: InvestigationStage.CONTRADICTION_CHECK, status: 'completed', timestamp: Date.now() - 800 },
      { stage: InvestigationStage.LOCALIZATION, status: 'completed', timestamp: Date.now() - 400 },
      { stage: InvestigationStage.STABILITY_TEST, status: 'completed', timestamp: Date.now() - 150 },
      { stage: InvestigationStage.FINAL_VERDICT, status: 'completed', timestamp: Date.now() },
    ],

    activatedModules: ['Visual Artifacts', 'Temporal Analysis', 'Audio Forensics', 'Lip-Sync Analysis', 'Metadata', 'Compression'],
    skippedModules: ['Text/Document Analysis'],
    contentDetected: 'Face + Speech (Degraded)',
    isDemo: true,
  };
}


// ─── Demo Registry ──────────────────────────────────────────────

export const DEMO_CASES = [
  {
    id: 'case-01',
    title: 'CASE 01 — AUTHENTIC',
    subtitle: 'Unmanipulated photograph',
    status: VerdictStatus.AUTHENTIC,
    factory: createAuthenticImageDemo,
  },
  {
    id: 'case-02',
    title: 'CASE 02 — MANIPULATED',
    subtitle: 'Deepfake video with face-swap',
    status: VerdictStatus.MANIPULATED,
    factory: createManipulatedVideoDemo,
  },
  {
    id: 'case-03',
    title: 'CASE 03 — INCONCLUSIVE',
    subtitle: 'Document scan with contradictory signals',
    status: VerdictStatus.INCONCLUSIVE,
    factory: createInconclusiveDemo,
  },
  {
    id: 'case-04',
    title: 'CASE 04 — COMPRESSED',
    subtitle: 'Re-encoded video with degraded evidence',
    status: VerdictStatus.MANIPULATED,
    factory: createCompressedReencodedDemo,
  },
];
