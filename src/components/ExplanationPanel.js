/**
 * FORENSIGHT — Explanation Panel Component
 * 
 * "WHY THIS VERDICT?" — Ranked forensic explanations.
 */

import { EvidenceDirection } from '../models/forensic-data.js';

function getStrengthLabel(strength) {
  switch (strength) {
    case 'strong':   return 'Strong supporting evidence';
    case 'moderate': return 'Moderate supporting evidence';
    case 'weak':     return 'Weak evidence';
    case 'none':     return 'No decisive evidence';
    default:         return '';
  }
}

export function renderExplanationPanel(analysis, container) {
  const { explanations, explanationSummary } = analysis;

  if (!explanations || explanations.length === 0) {
    container.innerHTML = `
      <div class="fs-panel">
        <div class="fs-panel-header">
          <span class="fs-panel-title">Why This Verdict?</span>
        </div>
        <div class="fs-panel-body" style="text-align:center; color: var(--fs-text-tertiary); padding: var(--fs-space-6);">
          Awaiting analysis
        </div>
      </div>
    `;
    return;
  }

  const items = explanations.map(exp => {
    const rankStr = String(exp.rank).padStart(2, '0');
    const dirColor = exp.direction === EvidenceDirection.CONTRADICTING ? 'contradicting' :
                     exp.direction === EvidenceDirection.INCONCLUSIVE ? 'inconclusive' : '';
    
    return `
      <div class="fs-explanation-item" data-rank="${exp.rank}">
        <div class="fs-explanation-rank">${rankStr}</div>
        <div class="fs-explanation-content">
          <div class="fs-explanation-title ${dirColor}">${exp.title}</div>
          <div class="fs-explanation-strength ${exp.strength}">${getStrengthLabel(exp.strength)}</div>
          <div class="fs-explanation-desc">${exp.description}</div>
        </div>
      </div>
    `;
  }).join('');

  const summaryHtml = explanationSummary ? `
    <div class="fs-explanation-summary">${explanationSummary}</div>
  ` : '';

  container.innerHTML = `
    <div class="fs-panel">
      <div class="fs-panel-header">
        <span class="fs-panel-title">Why This Verdict?</span>
      </div>
      <div class="fs-panel-body">
        <div class="fs-explanation-list">
          ${items}
        </div>
        ${summaryHtml}
      </div>
    </div>
  `;

  // Toggle expanded description on click
  container.querySelectorAll('.fs-explanation-item').forEach(item => {
    item.addEventListener('click', () => {
      item.classList.toggle('expanded');
    });
  });
}
