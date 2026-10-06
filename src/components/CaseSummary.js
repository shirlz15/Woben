/**
 * FORENSIGHT — Case Summary Component
 * 
 * Bottom-of-page forensic case summary with key metrics.
 */

import { countSignalsByDirection, EvidenceDirection, calculateStabilityScore, getVerdictColorClass } from '../models/forensic-data.js';

export function renderCaseSummary(analysis, container) {
  const { 
    mediaHash, mediaType, analysisTimeMs, signals, 
    verdictStatus, verdictLabel, verdictScore,
    activatedModules, stabilityResults 
  } = analysis;

  const activatedSignals = signals.filter(s => s.activated);
  const counts = countSignalsByDirection(activatedSignals);
  const supporting = counts[EvidenceDirection.SUPPORTING] || 0;
  const contradicting = counts[EvidenceDirection.CONTRADICTING] || 0;
  const unavailable = counts[EvidenceDirection.UNAVAILABLE] || 0;
  const stability = calculateStabilityScore(stabilityResults);
  const colorClass = getVerdictColorClass(verdictStatus);

  // Truncate hash for display
  const hashDisplay = mediaHash 
    ? `${mediaHash.substring(0, 8)}...${mediaHash.substring(mediaHash.length - 4)}`
    : '—';

  const analysisTime = analysisTimeMs !== null 
    ? `${(analysisTimeMs / 1000).toFixed(1)} sec`
    : '—';

  container.innerHTML = `
    <div class="fs-panel">
      <div class="fs-panel-header">
        <span class="fs-panel-title">Forensic Case Summary</span>
      </div>
      <div class="fs-panel-body">
        <div class="fs-case-summary">
          <div class="fs-case-summary-item">
            <span class="fs-case-summary-label">Evidence ID (SHA-256)</span>
            <span class="fs-case-summary-value hash" title="${mediaHash || ''}">${hashDisplay}</span>
          </div>
          <div class="fs-case-summary-item">
            <span class="fs-case-summary-label">Media Type</span>
            <span class="fs-case-summary-value">${(mediaType || '—').toUpperCase()}</span>
          </div>
          <div class="fs-case-summary-item">
            <span class="fs-case-summary-label">Analysis Time</span>
            <span class="fs-case-summary-value">${analysisTime}</span>
          </div>
          <div class="fs-case-summary-item">
            <span class="fs-case-summary-label">Forensic Modules</span>
            <span class="fs-case-summary-value">${activatedModules ? activatedModules.length : 0}</span>
          </div>
          <div class="fs-case-summary-item">
            <span class="fs-case-summary-label">Supporting Signals</span>
            <span class="fs-case-summary-value" style="color: var(--fs-red);">${supporting}</span>
          </div>
          <div class="fs-case-summary-item">
            <span class="fs-case-summary-label">Contradicting Signals</span>
            <span class="fs-case-summary-value" style="color: var(--fs-green);">${contradicting}</span>
          </div>
          <div class="fs-case-summary-item">
            <span class="fs-case-summary-label">Stability</span>
            <span class="fs-case-summary-value">${stability !== null ? stability + '%' : '—'}</span>
          </div>
          <div class="fs-case-summary-item">
            <span class="fs-case-summary-label">Final Verdict</span>
            <span class="fs-case-summary-value ${colorClass}">${verdictLabel || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}
