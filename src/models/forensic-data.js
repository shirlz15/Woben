/**
 * FORENSIGHT — Core Data Model
 * 
 * All UI components consume this data model.
 * Backend produces these structures; frontend renders them.
 * No UI component should invent data not present here.
 */

// ─── Evidence Direction ─────────────────────────────────────────
export const EvidenceDirection = Object.freeze({
  SUPPORTING:    'supporting',
  CONTRADICTING: 'contradicting',
  INCONCLUSIVE:  'inconclusive',
  UNAVAILABLE:   'unavailable',
});

// ─── Verdict Status ─────────────────────────────────────────────
export const VerdictStatus = Object.freeze({
  AUTHENTIC:     'authentic',
  MANIPULATED:   'manipulated',
  INCONCLUSIVE:  'inconclusive',
  PENDING:       'pending',
});

// ─── Media Type ─────────────────────────────────────────────────
export const MediaType = Object.freeze({
  IMAGE:    'image',
  VIDEO:    'video',
  AUDIO:    'audio',
  DOCUMENT: 'document',
});

// ─── Signal Type ────────────────────────────────────────────────
export const SignalType = Object.freeze({
  VISUAL:      'visual',
  TEMPORAL:    'temporal',
  AUDIO:       'audio',
  LIP_SYNC:    'lip_sync',
  METADATA:    'metadata',
  COMPRESSION: 'compression',
  FREQUENCY:   'frequency',
  FACE:        'face',
  TEXT:        'text',
});

// ─── Stability Status ───────────────────────────────────────────
export const StabilityStatus = Object.freeze({
  STABLE:    'stable',
  CHANGED:   'changed',
  UNSTABLE:  'unstable',
  UNTESTED:  'untested',
});

// ─── Investigation Stage ────────────────────────────────────────
export const InvestigationStage = Object.freeze({
  MEDIA_DETECTED:     'media_detected',
  MODALITY_IDENTIFIED:'modality_identified',
  TESTS_SELECTED:     'tests_selected',
  EVIDENCE_COLLECTED: 'evidence_collected',
  CONTRADICTION_CHECK:'contradiction_check',
  LOCALIZATION:       'localization',
  STABILITY_TEST:     'stability_test',
  FINAL_VERDICT:      'final_verdict',
});

export const StageLabels = Object.freeze({
  [InvestigationStage.MEDIA_DETECTED]:      'Media Detected',
  [InvestigationStage.MODALITY_IDENTIFIED]: 'Modality Identified',
  [InvestigationStage.TESTS_SELECTED]:      'Forensic Tests Selected',
  [InvestigationStage.EVIDENCE_COLLECTED]:  'Evidence Collected',
  [InvestigationStage.CONTRADICTION_CHECK]: 'Contradiction Check',
  [InvestigationStage.LOCALIZATION]:        'Localization',
  [InvestigationStage.STABILITY_TEST]:      'Stability Test',
  [InvestigationStage.FINAL_VERDICT]:       'Final Verdict',
});

// ─── Data Structures ────────────────────────────────────────────

/**
 * A single forensic evidence signal.
 * @typedef {Object} ForensicSignal
 * @property {string}  id          - Unique signal identifier
 * @property {string}  type        - SignalType value
 * @property {string}  label       - Human-readable label
 * @property {number|null} score   - 0–100, or null if unavailable
 * @property {string}  direction   - EvidenceDirection value
 * @property {string}  reliability - 'high' | 'moderate' | 'low' | 'unknown'
 * @property {string}  explanation - Short textual explanation
 * @property {boolean} activated   - Whether this signal was used in analysis
 */

/**
 * Evidence agreement between two signals.
 * @typedef {Object} EvidenceRelationship
 * @property {string} signalA    - Signal ID
 * @property {string} signalB    - Signal ID
 * @property {string} agreement  - '+' (supporting) | '?' (uncertain) | '×' (contradictory)
 */

/**
 * Stability test result for a single transformation.
 * @typedef {Object} StabilityResult
 * @property {string} transformation - 'original' | 'jpeg' | 'resize' | 'crop' | 're-encode'
 * @property {string} label          - Human-readable label
 * @property {number|null} score     - Verdict score after transformation
 * @property {string} status         - StabilityStatus value
 */

/**
 * A suspicious region (for images/video frames).
 * @typedef {Object} SuspiciousRegion
 * @property {number} x       - Normalized x (0–1)
 * @property {number} y       - Normalized y (0–1)
 * @property {number} width   - Normalized width (0–1)
 * @property {number} height  - Normalized height (0–1)
 * @property {number} intensity - Suspicion intensity (0–1)
 */

/**
 * A suspicious time segment in video/audio.
 * @typedef {Object} SuspiciousSegment
 * @property {number} startTime  - Seconds
 * @property {number} endTime    - Seconds
 * @property {string} signalType - Which signal detected it
 * @property {number} severity   - 0–1
 * @property {string} label      - Description
 */

/**
 * Cross-modal synchronization result.
 * @typedef {Object} CrossModalSync
 * @property {number|null} syncOffset    - Measured offset in seconds (null if consistent)
 * @property {boolean}     isConsistent  - Whether sync is within acceptable range
 * @property {string}      description   - Human-readable explanation
 * @property {Array}       expectedRanges - Expected speech segments
 * @property {Array}       observedRanges - Observed audio segments
 */

/**
 * Forensic explanation entry (ranked).
 * @typedef {Object} ExplanationEntry
 * @property {number} rank        - 1-based ranking
 * @property {string} title       - Short title
 * @property {string} strength    - 'strong' | 'moderate' | 'weak' | 'none'
 * @property {string} direction   - EvidenceDirection value
 * @property {string} description - Detailed explanation
 */

/**
 * Investigation flow stage status.
 * @typedef {Object} InvestigationStageStatus
 * @property {string} stage   - InvestigationStage value
 * @property {string} status  - 'completed' | 'running' | 'pending' | 'unavailable'
 * @property {number|null} timestamp - When this stage completed (ms)
 */

/**
 * Complete FORENSIGHT analysis result.
 * @typedef {Object} ForensicAnalysis
 * @property {string}   id                  - Analysis ID
 * @property {string}   mediaHash           - SHA-256 of input media
 * @property {string}   mediaType           - MediaType value
 * @property {string}   mediaUrl            - URL/path to media
 * @property {string}   fileName            - Original filename
 * @property {number}   analysisTimeMs      - Analysis duration
 * @property {Date}     timestamp           - When analysis was performed
 * 
 * @property {string}   verdictStatus       - VerdictStatus value
 * @property {number}   verdictScore        - 0–100 manipulation confidence
 * @property {string}   evidenceConfidence  - 'high' | 'moderate' | 'low'
 * @property {string}   verdictLabel        - Human-readable verdict
 * 
 * @property {ForensicSignal[]}           signals
 * @property {EvidenceRelationship[]}     relationships
 * @property {StabilityResult[]}          stabilityResults
 * @property {SuspiciousRegion[]}         suspiciousRegions
 * @property {SuspiciousSegment[]}        suspiciousSegments
 * @property {CrossModalSync|null}        crossModalSync
 * @property {ExplanationEntry[]}         explanations
 * @property {string}                     explanationSummary
 * @property {InvestigationStageStatus[]} investigationFlow
 * 
 * @property {string[]}  activatedModules   - Module names used
 * @property {string[]}  skippedModules     - Modules not applicable
 * @property {string}    contentDetected    - What content types were detected
 * @property {boolean}   isDemo             - Whether this is demo data
 */


// ─── Factory: Empty Analysis ────────────────────────────────────

export function createEmptyAnalysis() {
  return {
    id: null,
    mediaHash: null,
    mediaType: null,
    mediaUrl: null,
    fileName: null,
    analysisTimeMs: null,
    timestamp: null,

    verdictStatus: VerdictStatus.PENDING,
    verdictScore: null,
    evidenceConfidence: null,
    verdictLabel: 'Awaiting analysis',

    signals: [],
    relationships: [],
    stabilityResults: [],
    suspiciousRegions: [],
    suspiciousSegments: [],
    crossModalSync: null,
    explanations: [],
    explanationSummary: null,
    investigationFlow: Object.values(InvestigationStage).map(stage => ({
      stage,
      status: 'pending',
      timestamp: null,
    })),

    activatedModules: [],
    skippedModules: [],
    contentDetected: null,
    isDemo: false,
  };
}


// ─── Helpers ────────────────────────────────────────────────────

/** Get the semantic color class for a verdict status */
export function getVerdictColorClass(status) {
  switch (status) {
    case VerdictStatus.AUTHENTIC:    return 'verdict-authentic';
    case VerdictStatus.MANIPULATED:  return 'verdict-manipulated';
    case VerdictStatus.INCONCLUSIVE: return 'verdict-inconclusive';
    default:                         return 'verdict-pending';
  }
}

/** Get the semantic color class for an evidence direction */
export function getDirectionColorClass(direction) {
  switch (direction) {
    case EvidenceDirection.SUPPORTING:    return 'evidence-supporting';
    case EvidenceDirection.CONTRADICTING: return 'evidence-contradicting';
    case EvidenceDirection.INCONCLUSIVE:  return 'evidence-inconclusive';
    default:                             return 'evidence-unavailable';
  }
}

/** Count signals by direction */
export function countSignalsByDirection(signals) {
  return signals.reduce((acc, s) => {
    acc[s.direction] = (acc[s.direction] || 0) + 1;
    return acc;
  }, {});
}

/** Calculate overall stability score (average of non-null scores) */
export function calculateStabilityScore(stabilityResults) {
  const valid = stabilityResults.filter(r => r.score !== null && r.transformation !== 'original');
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, r) => sum + r.score, 0) / valid.length);
}

/** Determine overall stability status */
export function getOverallStabilityStatus(stabilityResults) {
  const statuses = stabilityResults
    .filter(r => r.transformation !== 'original')
    .map(r => r.status);

  if (statuses.length === 0) return StabilityStatus.UNTESTED;
  if (statuses.includes(StabilityStatus.UNSTABLE)) return StabilityStatus.UNSTABLE;
  if (statuses.includes(StabilityStatus.CHANGED)) return StabilityStatus.CHANGED;
  return StabilityStatus.STABLE;
}

/** Build the evidence agreement matrix from relationships */
export function buildAgreementMatrix(signals, relationships) {
  const activeSignals = signals.filter(s => s.activated);
  const matrix = {};

  activeSignals.forEach(a => {
    matrix[a.id] = {};
    activeSignals.forEach(b => {
      if (a.id === b.id) {
        matrix[a.id][b.id] = '—';
      } else {
        matrix[a.id][b.id] = '?'; // default unknown
      }
    });
  });

  relationships.forEach(rel => {
    if (matrix[rel.signalA] && matrix[rel.signalA][rel.signalB] !== undefined) {
      matrix[rel.signalA][rel.signalB] = rel.agreement;
    }
    if (matrix[rel.signalB] && matrix[rel.signalB][rel.signalA] !== undefined) {
      matrix[rel.signalB][rel.signalA] = rel.agreement;
    }
  });

  return { signals: activeSignals, matrix };
}
