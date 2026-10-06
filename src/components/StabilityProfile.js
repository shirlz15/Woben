/**
 * FORENSIGHT — Stability Profile Component
 * 
 * SVG line chart showing verdict scores across transformations.
 * Plus robustness check list and overall stability summary.
 */

import { calculateStabilityScore, getOverallStabilityStatus, StabilityStatus } from '../models/forensic-data.js';

function getStatusSymbol(status) {
  switch (status) {
    case StabilityStatus.STABLE:   return '✓';
    case StabilityStatus.CHANGED:  return '⚠';
    case StabilityStatus.UNSTABLE: return '✕';
    default:                       return '—';
  }
}

function getStatusLabel(status) {
  switch (status) {
    case StabilityStatus.STABLE:   return 'Stable';
    case StabilityStatus.CHANGED:  return 'Changed';
    case StabilityStatus.UNSTABLE: return 'Unstable';
    default:                       return 'Untested';
  }
}

function getStatusClass(status) {
  switch (status) {
    case StabilityStatus.STABLE:   return 'stable';
    case StabilityStatus.CHANGED:  return 'changed';
    case StabilityStatus.UNSTABLE: return 'unstable';
    default:                       return '';
  }
}

function getLineColor(overallStatus) {
  switch (overallStatus) {
    case StabilityStatus.STABLE:   return '#22c55e';
    case StabilityStatus.CHANGED:  return '#f59e0b';
    case StabilityStatus.UNSTABLE: return '#ef4444';
    default:                       return '#64748b';
  }
}

export function renderStabilityProfile(analysis, container) {
  const { stabilityResults } = analysis;

  if (!stabilityResults || stabilityResults.length === 0) {
    container.innerHTML = `
      <div class="fs-panel">
        <div class="fs-panel-header">
          <span class="fs-panel-title">Forensic Stability Profile</span>
        </div>
        <div class="fs-panel-body" style="text-align:center; color: var(--fs-text-tertiary); padding: var(--fs-space-6);">
          Stability test not performed
        </div>
      </div>
    `;
    return;
  }

  const overallScore = calculateStabilityScore(stabilityResults);
  const overallStatus = getOverallStabilityStatus(stabilityResults);
  const lineColor = getLineColor(overallStatus);

  // ─── SVG Chart ────────────────────────────────────
  const svgWidth = 400;
  const svgHeight = 180;
  const paddingLeft = 36;
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = 28;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const validResults = stabilityResults.filter(r => r.score !== null);
  
  // Y scale: 0–100 but focus on relevant range
  const scores = validResults.map(r => r.score);
  const minScore = Math.max(0, Math.min(...scores) - 10);
  const maxScore = Math.min(100, Math.max(...scores) + 10);
  const range = maxScore - minScore || 20;

  const yScale = (val) => paddingTop + chartHeight - ((val - minScore) / range) * chartHeight;
  const xScale = (i) => paddingLeft + (i / (validResults.length - 1 || 1)) * chartWidth;

  // Grid lines
  let gridHtml = '';
  const gridSteps = [minScore, minScore + range * 0.25, minScore + range * 0.5, minScore + range * 0.75, maxScore];
  gridSteps.forEach(val => {
    const y = yScale(val);
    gridHtml += `
      <line x1="${paddingLeft}" y1="${y}" x2="${svgWidth - paddingRight}" y2="${y}" class="fs-stability-gridline" />
      <text x="${paddingLeft - 6}" y="${y + 3}" text-anchor="end" class="fs-stability-label">${Math.round(val)}</text>
    `;
  });

  // Data points and line
  const points = validResults.map((r, i) => `${xScale(i)},${yScale(r.score)}`);
  const polylinePoints = points.join(' ');
  
  // Area fill
  const areaPoints = [
    `${xScale(0)},${paddingTop + chartHeight}`,
    ...points,
    `${xScale(validResults.length - 1)},${paddingTop + chartHeight}`,
  ].join(' ');

  // Data points as circles
  let dotsHtml = '';
  let labelsHtml = '';
  validResults.forEach((r, i) => {
    const x = xScale(i);
    const y = yScale(r.score);
    dotsHtml += `
      <circle cx="${x}" cy="${y}" r="4" 
              fill="${lineColor}" stroke="var(--fs-bg-primary)" stroke-width="2"
              class="fs-stability-dot" />
    `;
    labelsHtml += `
      <text x="${x}" y="${paddingTop + chartHeight + 16}" text-anchor="middle" class="fs-stability-label">
        ${r.label.charAt(0)}
      </text>
    `;
  });

  // ─── Robustness list ──────────────────────────────
  const transformResults = stabilityResults.filter(r => r.transformation !== 'original');
  const robustnessItems = transformResults.map(r => {
    const statusClass = getStatusClass(r.status);
    const symbol = getStatusSymbol(r.status);
    const label = getStatusLabel(r.status);
    return `
      <div class="fs-robustness-item">
        <span>${r.label}</span>
        <span class="fs-robustness-status ${statusClass}">${symbol} ${label}</span>
      </div>
    `;
  }).join('');

  // ─── Legend ───────────────────────────────────────
  const legendItems = validResults.map(r => `${r.label.charAt(0)} = ${r.label}`).join('  ·  ');

  container.innerHTML = `
    <div class="fs-panel">
      <div class="fs-panel-header">
        <span class="fs-panel-title">Forensic Stability Profile</span>
      </div>
      <div class="fs-panel-body">
        <div class="fs-stability-chart">
          <svg class="fs-stability-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet">
            ${gridHtml}
            <polygon points="${areaPoints}" fill="${lineColor}" class="fs-stability-area" />
            <polyline points="${polylinePoints}" stroke="${lineColor}" class="fs-stability-line" />
            ${dotsHtml}
            ${labelsHtml}
          </svg>
        </div>
        <div style="font-size: var(--fs-text-xs); color: var(--fs-text-disabled); margin-bottom: var(--fs-space-3); text-align: center;">
          ${legendItems}
        </div>
        <div class="fs-stability-summary">
          <div>
            <div class="fs-stability-score-label">Forensic Stability</div>
            <div class="fs-stability-score-value" style="color: ${lineColor};">${overallScore !== null ? overallScore + '%' : '—'}</div>
          </div>
          <div class="fs-stability-status ${getStatusClass(overallStatus)}">
            ${overallStatus === StabilityStatus.UNSTABLE ? 'Forensically Unstable · Verify Manually' : getStatusLabel(overallStatus).toUpperCase()}
          </div>
        </div>
        <div class="fs-robustness-list">
          ${robustnessItems}
        </div>
      </div>
    </div>
  `;
}
