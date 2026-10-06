/**
 * FORENSIGHT — Evidence Matrix Component
 * 
 * Compact cross-signal agreement/contradiction matrix.
 * Shows +, ?, × relationships between activated forensic signals.
 */

import { buildAgreementMatrix } from '../models/forensic-data.js';

function getCellClass(value) {
  switch (value) {
    case '—': return 'agreement-self';
    case '+': return 'agreement-supporting';
    case '?': return 'agreement-uncertain';
    case '×': return 'agreement-contradictory';
    default:  return 'agreement-uncertain';
  }
}

function getCellSymbol(value) {
  switch (value) {
    case '—': return '—';
    case '+': return '+';
    case '?': return '?';
    case '×': return '×';
    default:  return '?';
  }
}

export function renderEvidenceMatrix(analysis, container) {
  const { signals, relationships } = analysis;
  const { signals: activeSignals, matrix } = buildAgreementMatrix(signals, relationships);

  if (activeSignals.length < 2) {
    container.innerHTML = `
      <div class="fs-panel">
        <div class="fs-panel-header">
          <span class="fs-panel-title">Evidence Agreement Matrix</span>
        </div>
        <div class="fs-panel-body" style="text-align:center; color: var(--fs-text-tertiary); padding: var(--fs-space-6);">
          Insufficient signals for matrix
        </div>
      </div>
    `;
    return;
  }

  // Build header row
  let headerCells = '<th></th>';
  activeSignals.forEach(s => {
    // Abbreviate labels for header
    const abbr = s.label.split(' ')[0].substring(0, 6);
    headerCells += `<th>${abbr}</th>`;
  });

  // Build data rows
  let rows = '';
  activeSignals.forEach(rowSignal => {
    let cells = `<td>${rowSignal.label}</td>`;
    activeSignals.forEach(colSignal => {
      const value = matrix[rowSignal.id][colSignal.id];
      const cellClass = getCellClass(value);
      const symbol = getCellSymbol(value);
      cells += `<td><span class="fs-matrix-cell ${cellClass}">${symbol}</span></td>`;
    });
    rows += `<tr>${cells}</tr>`;
  });

  container.innerHTML = `
    <div class="fs-panel">
      <div class="fs-panel-header">
        <span class="fs-panel-title">Evidence Agreement Matrix</span>
      </div>
      <div class="fs-panel-body">
        <div class="fs-matrix-wrapper">
          <table class="fs-matrix">
            <thead><tr>${headerCells}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div style="display: flex; gap: var(--fs-space-4); margin-top: var(--fs-space-3); font-size: var(--fs-text-xs); color: var(--fs-text-tertiary);">
          <span><span class="fs-matrix-cell agreement-supporting" style="display:inline-flex; width:18px; height:18px; font-size:10px; vertical-align:middle;">+</span> Supporting</span>
          <span><span class="fs-matrix-cell agreement-uncertain" style="display:inline-flex; width:18px; height:18px; font-size:10px; vertical-align:middle;">?</span> Uncertain</span>
          <span><span class="fs-matrix-cell agreement-contradictory" style="display:inline-flex; width:18px; height:18px; font-size:10px; vertical-align:middle;">×</span> Contradictory</span>
        </div>
      </div>
    </div>
  `;
}
