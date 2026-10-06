/**
 * FORENSIGHT — Signal Bars Component
 * 
 * Forensic evidence breakdown with animated bars.
 * Each signal is expandable to show explanation.
 */

import { EvidenceDirection } from '../models/forensic-data.js';

function getDirectionLabel(direction) {
  switch (direction) {
    case EvidenceDirection.SUPPORTING:    return 'Supporting';
    case EvidenceDirection.CONTRADICTING: return 'Contradicting';
    case EvidenceDirection.INCONCLUSIVE:  return 'Inconclusive';
    case EvidenceDirection.UNAVAILABLE:   return 'N/A';
    default:                             return 'Unknown';
  }
}

export function renderSignalBars(analysis, container) {
  const { signals } = analysis;
  const activatedSignals = signals.filter(s => s.activated);
  const inactiveSignals = signals.filter(s => !s.activated);

  let signalItems = activatedSignals.map(signal => {
    const scoreText = signal.score !== null ? `${signal.score}%` : '—';
    const barWidth = signal.score !== null ? signal.score : 0;
    const dirLabel = getDirectionLabel(signal.direction);

    return `
      <div class="fs-signal-item" data-signal-id="${signal.id}">
        <div class="fs-signal-header">
          <span class="fs-signal-label">${signal.label}</span>
          <div class="fs-signal-meta">
            ${signal.reliability !== 'unknown' ? `<span style="font-size: var(--fs-text-xs); color: var(--fs-text-disabled);">${signal.reliability}</span>` : ''}
            <span class="fs-signal-score ${signal.direction}">${scoreText}</span>
            <span class="fs-signal-direction ${signal.direction}">${dirLabel}</span>
          </div>
        </div>
        <div class="fs-signal-bar-track">
          <div class="fs-signal-bar-fill ${signal.direction}" style="width: 0%;" data-target-width="${barWidth}%"></div>
        </div>
        <div class="fs-signal-explanation">${signal.explanation}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="fs-panel">
      <div class="fs-panel-header">
        <span class="fs-panel-title">Forensic Signal Breakdown</span>
        <span style="font-size: var(--fs-text-xs); color: var(--fs-text-tertiary);">
          ${activatedSignals.length} active${inactiveSignals.length > 0 ? ` · ${inactiveSignals.length} N/A` : ''}
        </span>
      </div>
      <div class="fs-panel-body">
        <div class="fs-signal-list">
          ${signalItems}
        </div>
      </div>
    </div>
  `;

  // Animate bars in
  requestAnimationFrame(() => {
    setTimeout(() => {
      container.querySelectorAll('.fs-signal-bar-fill').forEach(fill => {
        fill.style.width = fill.dataset.targetWidth;
      });
    }, 100);
  });

  // Toggle explanation on click
  container.querySelectorAll('.fs-signal-item').forEach(item => {
    item.addEventListener('click', () => {
      item.classList.toggle('expanded');
    });
  });
}
