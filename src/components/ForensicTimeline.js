/**
 * FORENSIGHT — Forensic Timeline Component
 * 
 * Multi-track SVG timeline for video suspicious segments.
 * Each evidence type gets its own horizontal track.
 * Clicking a segment could seek a video to that timestamp.
 */

import { SignalType } from '../models/forensic-data.js';

const TRACK_COLORS = {
  [SignalType.VISUAL]:   '#ef4444',
  [SignalType.TEMPORAL]:  '#f59e0b',
  [SignalType.AUDIO]:     '#3b82f6',
  [SignalType.LIP_SYNC]:  '#a855f7',
  [SignalType.FACE]:      '#ec4899',
};

const TRACK_LABELS = {
  [SignalType.VISUAL]:    'VISUAL',
  [SignalType.TEMPORAL]:  'TEMPORAL',
  [SignalType.AUDIO]:     'AUDIO',
  [SignalType.LIP_SYNC]:  'LIP-SYNC',
  [SignalType.FACE]:      'FACE',
};

export function renderForensicTimeline(analysis, container, options = {}) {
  const { suspiciousSegments, mediaType } = analysis;
  const { onSeek } = options;

  if (mediaType !== 'video' && mediaType !== 'audio') {
    container.innerHTML = `
      <div class="fs-panel">
        <div class="fs-panel-header">
          <span class="fs-panel-title">Forensic Timeline</span>
        </div>
        <div class="fs-panel-body fs-timeline-no-data">
          Timeline not applicable for ${mediaType || 'this'} media
        </div>
      </div>
    `;
    return;
  }

  if (!suspiciousSegments || suspiciousSegments.length === 0) {
    container.innerHTML = `
      <div class="fs-panel">
        <div class="fs-panel-header">
          <span class="fs-panel-title">Forensic Timeline</span>
        </div>
        <div class="fs-panel-body fs-timeline-no-data">
          No suspicious segments detected
        </div>
      </div>
    `;
    return;
  }

  // Determine total duration
  const maxTime = Math.max(...suspiciousSegments.map(s => s.endTime)) * 1.15;
  const minTime = 0;

  // Group segments by signal type (tracks)
  const trackTypes = [...new Set(suspiciousSegments.map(s => s.signalType))];
  
  // SVG dimensions
  const svgWidth = 600;
  const trackHeight = 24;
  const trackGap = 8;
  const labelWidth = 80;
  const paddingTop = 28;
  const paddingBottom = 24;
  const paddingRight = 16;
  const chartWidth = svgWidth - labelWidth - paddingRight;
  const svgHeight = paddingTop + trackTypes.length * (trackHeight + trackGap) + paddingBottom;

  const xScale = (t) => labelWidth + ((t - minTime) / (maxTime - minTime)) * chartWidth;

  // Time ruler
  let rulerHtml = '';
  const tickCount = Math.min(8, Math.ceil(maxTime / 5) + 1);
  for (let i = 0; i <= tickCount; i++) {
    const t = minTime + (i / tickCount) * (maxTime - minTime);
    const x = xScale(t);
    const minutes = Math.floor(t / 60);
    const seconds = (t % 60).toFixed(0).padStart(2, '0');
    rulerHtml += `
      <line x1="${x}" y1="${paddingTop - 8}" x2="${x}" y2="${svgHeight - paddingBottom}" 
            stroke="var(--fs-border-subtle)" stroke-width="0.5" stroke-opacity="0.5" />
      <text x="${x}" y="${paddingTop - 14}" text-anchor="middle" class="fs-timeline-tick-label">
        ${minutes}:${seconds}
      </text>
    `;
  }

  // Tracks
  let tracksHtml = '';
  trackTypes.forEach((type, trackIndex) => {
    const y = paddingTop + trackIndex * (trackHeight + trackGap);
    const color = TRACK_COLORS[type] || '#64748b';
    const label = TRACK_LABELS[type] || type;

    // Track background
    tracksHtml += `
      <rect x="${labelWidth}" y="${y}" width="${chartWidth}" height="${trackHeight}" 
            class="fs-timeline-track-bg" rx="2" />
      <text x="${labelWidth - 8}" y="${y + trackHeight / 2 + 3}" 
            text-anchor="end" class="fs-timeline-track-label">${label}</text>
    `;

    // Segments on this track
    const trackSegments = suspiciousSegments.filter(s => s.signalType === type);
    trackSegments.forEach(seg => {
      const x1 = xScale(seg.startTime);
      const x2 = xScale(seg.endTime);
      const width = Math.max(x2 - x1, 4);
      
      tracksHtml += `
        <rect x="${x1}" y="${y + 2}" width="${width}" height="${trackHeight - 4}" 
              rx="2" fill="${color}" fill-opacity="${0.3 + seg.severity * 0.5}"
              class="fs-timeline-segment" 
              data-start="${seg.startTime}" data-end="${seg.endTime}" 
              data-label="${seg.label}">
          <title>${seg.label}\n${seg.startTime.toFixed(1)}s – ${seg.endTime.toFixed(1)}s\nSeverity: ${Math.round(seg.severity * 100)}%</title>
        </rect>
      `;
    });
  });

  // Suspicious range annotation
  const allStart = Math.min(...suspiciousSegments.map(s => s.startTime));
  const allEnd = Math.max(...suspiciousSegments.map(s => s.endTime));
  const annotY = svgHeight - paddingBottom + 6;

  const annotHtml = `
    <line x1="${xScale(allStart)}" y1="${paddingTop}" x2="${xScale(allStart)}" y2="${svgHeight - paddingBottom}" 
          stroke="${TRACK_COLORS[SignalType.VISUAL]}" stroke-width="1" stroke-dasharray="4 3" stroke-opacity="0.4" />
    <line x1="${xScale(allEnd)}" y1="${paddingTop}" x2="${xScale(allEnd)}" y2="${svgHeight - paddingBottom}" 
          stroke="${TRACK_COLORS[SignalType.VISUAL]}" stroke-width="1" stroke-dasharray="4 3" stroke-opacity="0.4" />
    <text x="${(xScale(allStart) + xScale(allEnd)) / 2}" y="${annotY + 10}" 
          text-anchor="middle" class="fs-timeline-tick-label" fill="var(--fs-red)" opacity="0.7">
      SUSPICIOUS ${allStart.toFixed(1)}s – ${allEnd.toFixed(1)}s
    </text>
  `;

  container.innerHTML = `
    <div class="fs-panel fs-timeline">
      <div class="fs-panel-header">
        <span class="fs-panel-title">Forensic Timeline</span>
        <span style="font-size: var(--fs-text-xs); color: var(--fs-text-tertiary);">
          ${suspiciousSegments.length} segment${suspiciousSegments.length !== 1 ? 's' : ''} detected
        </span>
      </div>
      <div class="fs-panel-body" style="overflow-x: auto;">
        <svg class="fs-timeline-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet">
          ${rulerHtml}
          ${tracksHtml}
          ${annotHtml}
        </svg>
      </div>
    </div>
  `;

  // Click handler for segments
  container.querySelectorAll('.fs-timeline-segment').forEach(seg => {
    seg.addEventListener('click', () => {
      const startTime = parseFloat(seg.dataset.start);
      if (onSeek && typeof onSeek === 'function') {
        onSeek(startTime);
      }
    });
  });
}
