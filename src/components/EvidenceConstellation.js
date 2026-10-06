/**
 * FORENSIGHT — Evidence Constellation Component
 * 
 * SVG-based visualization showing the verdict center node
 * connected to evidence signal nodes around it.
 * 
 * Each node shows: label, score, direction.
 * Lines show: supporting, contradicting, or uncertain relationships.
 */

import { getVerdictColorClass, EvidenceDirection, VerdictStatus } from '../models/forensic-data.js';

const COLORS = {
  supporting:    '#ef4444',
  contradicting: '#22c55e',
  inconclusive:  '#f59e0b',
  unavailable:   '#3d4660',
  authentic:     '#22c55e',
  manipulated:   '#ef4444',
  pending:       '#5d6882',
};

function getNodeColor(direction) {
  return COLORS[direction] || COLORS.unavailable;
}

function getVerdictColor(status) {
  if (status === VerdictStatus.AUTHENTIC) return COLORS.authentic;
  if (status === VerdictStatus.MANIPULATED) return COLORS.manipulated;
  if (status === VerdictStatus.INCONCLUSIVE) return COLORS.inconclusive;
  return COLORS.pending;
}

function getLinkStyle(agreement) {
  switch (agreement) {
    case '+': return { stroke: COLORS.supporting, dasharray: '', opacity: 0.45 };
    case '×': return { stroke: COLORS.contradicting, dasharray: '6 4', opacity: 0.5 };
    case '?': return { stroke: COLORS.inconclusive, dasharray: '3 3', opacity: 0.25 };
    default:  return { stroke: COLORS.unavailable, dasharray: '2 6', opacity: 0.15 };
  }
}

export function renderEvidenceConstellation(analysis, container) {
  const { signals, relationships, verdictStatus, verdictScore, verdictLabel } = analysis;
  
  const activeSignals = signals.filter(s => s.activated);
  if (activeSignals.length === 0) {
    container.innerHTML = `
      <div class="fs-panel">
        <div class="fs-panel-header">
          <span class="fs-panel-title">Evidence Constellation</span>
        </div>
        <div class="fs-panel-body" style="text-align:center; color: var(--fs-text-tertiary); padding: var(--fs-space-10);">
          No active evidence signals
        </div>
      </div>
    `;
    return;
  }

  const size = 420;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.35;
  const nodeRadius = 18;
  const centerRadius = 28;

  // Calculate node positions around circle
  const nodePositions = activeSignals.map((signal, i) => {
    const angle = (i / activeSignals.length) * Math.PI * 2 - Math.PI / 2;
    return {
      signal,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      angle,
    };
  });

  // Build relationship lookup
  const relLookup = {};
  relationships.forEach(r => {
    relLookup[`${r.signalA}-${r.signalB}`] = r.agreement;
    relLookup[`${r.signalB}-${r.signalA}`] = r.agreement;
  });

  // SVG content
  let linksHtml = '';
  let nodesHtml = '';

  // Draw links from each node to center
  nodePositions.forEach(({ signal, x, y }) => {
    const style = getLinkStyle(signal.direction === EvidenceDirection.SUPPORTING ? '+' : 
                               signal.direction === EvidenceDirection.CONTRADICTING ? '×' : '?');
    linksHtml += `
      <line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" 
            stroke="${style.stroke}" stroke-opacity="${style.opacity}" 
            stroke-width="1.5" stroke-dasharray="${style.dasharray}"
            class="fs-constellation-link" />
    `;
  });

  // Draw inter-node relationship lines (subtle)
  for (let i = 0; i < nodePositions.length; i++) {
    for (let j = i + 1; j < nodePositions.length; j++) {
      const a = nodePositions[i];
      const b = nodePositions[j];
      const agreement = relLookup[`${a.signal.id}-${b.signal.id}`];
      if (agreement === '×') {
        // Only draw contradictory inter-node links to keep it clean
        linksHtml += `
          <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" 
                stroke="${COLORS.contradicting}" stroke-opacity="0.2" 
                stroke-width="1" stroke-dasharray="4 4" />
        `;
      }
    }
  }

  // Draw evidence nodes
  nodePositions.forEach(({ signal, x, y, angle }) => {
    const color = getNodeColor(signal.direction);
    const scoreText = signal.score !== null ? `${signal.score}%` : '—';

    // Label positioning
    const labelDx = Math.cos(angle) * 34;
    const labelDy = Math.sin(angle) * 34;
    const labelAnchor = Math.abs(angle) < 0.1 || Math.abs(angle - Math.PI) < 0.1 
      ? 'middle' 
      : (angle > -Math.PI / 2 && angle < Math.PI / 2) ? 'start' : 'end';

    nodesHtml += `
      <g class="fs-constellation-node" data-signal-id="${signal.id}">
        <circle cx="${x}" cy="${y}" r="${nodeRadius}" 
                fill="${color}" fill-opacity="0.12" 
                stroke="${color}" stroke-width="1.5" stroke-opacity="0.6" />
        <circle cx="${x}" cy="${y}" r="4" fill="${color}" fill-opacity="0.9" />
        <text x="${x + labelDx}" y="${y + labelDy - 6}" 
              text-anchor="${labelAnchor}" class="fs-constellation-label">
          ${signal.label.toUpperCase()}
        </text>
        <text x="${x + labelDx}" y="${y + labelDy + 8}" 
              text-anchor="${labelAnchor}" class="fs-constellation-score"
              fill="${color}">
          ${scoreText}
        </text>
      </g>
    `;
  });

  // Center verdict node
  const verdictColor = getVerdictColor(verdictStatus);
  const centerScoreText = verdictScore !== null ? `${verdictScore}%` : '—';
  
  nodesHtml += `
    <circle cx="${cx}" cy="${cy}" r="${centerRadius}" 
            fill="${verdictColor}" fill-opacity="0.1" 
            stroke="${verdictColor}" stroke-width="2" stroke-opacity="0.5" />
    <circle cx="${cx}" cy="${cy}" r="6" fill="${verdictColor}" />
    <text x="${cx}" y="${cy - 8}" text-anchor="middle" 
          class="fs-constellation-center-label" fill="${verdictColor}">
      VERDICT
    </text>
    <text x="${cx}" y="${cy + 16}" text-anchor="middle" 
          class="fs-constellation-center-score" fill="${verdictColor}">
      ${centerScoreText}
    </text>
  `;

  container.innerHTML = `
    <div class="fs-panel fs-constellation">
      <div class="fs-panel-header">
        <span class="fs-panel-title">Evidence Constellation</span>
      </div>
      <div class="fs-panel-body" style="position: relative;">
        <svg class="fs-constellation-canvas" viewBox="0 0 ${size} ${size}">
          ${linksHtml}
          ${nodesHtml}
        </svg>
        <div class="fs-constellation-tooltip" id="constellation-tooltip">
          <div class="fs-constellation-tooltip-title"></div>
          <div class="fs-constellation-tooltip-body"></div>
        </div>
      </div>
    </div>
  `;

  // Interactive tooltips
  const tooltip = container.querySelector('#constellation-tooltip');
  container.querySelectorAll('.fs-constellation-node').forEach(node => {
    node.addEventListener('mouseenter', (e) => {
      const signalId = node.dataset.signalId;
      const signal = activeSignals.find(s => s.id === signalId);
      if (!signal) return;

      const title = tooltip.querySelector('.fs-constellation-tooltip-title');
      const body = tooltip.querySelector('.fs-constellation-tooltip-body');
      title.textContent = signal.label;
      title.style.color = getNodeColor(signal.direction);
      body.textContent = signal.explanation;
      
      const rect = container.querySelector('.fs-panel-body').getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      tooltip.style.left = `${nodeRect.left - rect.left + nodeRect.width / 2}px`;
      tooltip.style.top = `${nodeRect.top - rect.top - 10}px`;
      tooltip.style.transform = 'translate(-50%, -100%)';
      tooltip.classList.add('visible');
    });

    node.addEventListener('mouseleave', () => {
      tooltip.classList.remove('visible');
    });
  });
}
