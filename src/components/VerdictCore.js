/**
 * FORENSIGHT — Verdict Core Component
 * 
 * Primary verdict display with connected evidence summary.
 * Consumes ForensicAnalysis data.
 */

import { VerdictStatus, getVerdictColorClass, countSignalsByDirection, EvidenceDirection } from '../models/forensic-data.js';

export function renderVerdictCore(analysis, container) {
  const { verdictStatus, verdictScore, verdictLabel, evidenceConfidence, signals, isDemo } = analysis;
  const colorClass = getVerdictColorClass(verdictStatus);
  
  const activatedSignals = signals.filter(s => s.activated);
  const directionCounts = countSignalsByDirection(activatedSignals);
  const supportingCount = directionCounts[EvidenceDirection.SUPPORTING] || 0;
  const contradictingCount = directionCounts[EvidenceDirection.CONTRADICTING] || 0;
  
  // Build supporting signals summary
  let signalsSummary = '';
  if (supportingCount > 0) {
    signalsSummary = `${supportingCount} independent signal${supportingCount !== 1 ? 's' : ''} support${supportingCount === 1 ? 's' : ''} the ${verdictStatus === VerdictStatus.MANIPULATED ? 'manipulation' : 'authenticity'} hypothesis.`;
  }
  if (contradictingCount > 0) {
    signalsSummary += ` ${contradictingCount} signal${contradictingCount !== 1 ? 's' : ''} contradict${contradictingCount === 1 ? 's' : ''}.`;
  }
  
  // Score display
  let scoreHtml = '';
  if (verdictScore !== null) {
    scoreHtml = `<div class="fs-verdict-score ${colorClass}">${verdictScore}<span class="score-unit">%</span></div>`;
  } else {
    scoreHtml = `<div class="fs-verdict-score" style="font-size: var(--fs-text-xl); color: var(--fs-text-tertiary);">—</div>`;
  }
  
  // Confidence
  let confidenceHtml = '';
  if (evidenceConfidence) {
    confidenceHtml = `<div class="fs-verdict-confidence">Evidence confidence: <strong>${evidenceConfidence}</strong></div>`;
  }
  
  // Recommendation for inconclusive
  let recommendationHtml = '';
  if (verdictStatus === VerdictStatus.INCONCLUSIVE) {
    recommendationHtml = `
      <div class="fs-verdict-recommendation">
        ⚠ Verify Manually
      </div>
    `;
  }
  
  container.innerHTML = `
    <div class="fs-panel">
      <div class="fs-verdict-core" data-status="${verdictStatus}">
        <div class="fs-verdict-label-top">
          FORENSIGHT${isDemo ? ' <span class="fs-demo-badge">DEMO</span>' : ''}
        </div>
        <div class="fs-verdict-status ${colorClass}">${verdictLabel}</div>
        ${scoreHtml}
        ${confidenceHtml}
        <div class="fs-verdict-summary">${signalsSummary}</div>
        ${recommendationHtml}
      </div>
    </div>
  `;
}
