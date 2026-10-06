/**
 * FORENSIGHT — Cross-Modal Consistency Component
 * 
 * Shows audio-visual synchronization analysis.
 * Displays expected vs observed speech ranges and sync offset.
 */

export function renderCrossModalView(analysis, container) {
  const { crossModalSync, mediaType } = analysis;

  if (mediaType !== 'video') {
    container.innerHTML = `
      <div class="fs-panel">
        <div class="fs-panel-header">
          <span class="fs-panel-title">Cross-Modal Consistency</span>
        </div>
        <div class="fs-panel-body" style="text-align:center; color: var(--fs-text-tertiary); padding: var(--fs-space-6);">
          Cross-modal analysis not applicable for ${mediaType || 'this'} media
        </div>
      </div>
    `;
    return;
  }

  if (!crossModalSync) {
    container.innerHTML = `
      <div class="fs-panel">
        <div class="fs-panel-header">
          <span class="fs-panel-title">Cross-Modal Consistency</span>
        </div>
        <div class="fs-panel-body" style="text-align:center; color: var(--fs-text-tertiary); padding: var(--fs-space-6);">
          Cross-modal analysis unavailable
        </div>
      </div>
    `;
    return;
  }

  const { syncOffset, isConsistent, description, expectedRanges, observedRanges } = crossModalSync;

  if (isConsistent) {
    container.innerHTML = `
      <div class="fs-panel">
        <div class="fs-panel-header">
          <span class="fs-panel-title">Cross-Modal Consistency</span>
        </div>
        <div class="fs-panel-body">
          <div class="fs-crossmodal-consistent">✓ Sync Consistent</div>
          ${description ? `<div class="fs-crossmodal-description">${description}</div>` : ''}
        </div>
      </div>
    `;
    return;
  }

  // Build visual bars for expected vs observed
  // Calculate total range for the visualization
  const allTimes = [
    ...(expectedRanges || []).flatMap(r => [r.start, r.end]),
    ...(observedRanges || []).flatMap(r => [r.start, r.end]),
  ];
  const tMin = Math.min(...allTimes) - 1;
  const tMax = Math.max(...allTimes) + 1;
  const tRange = tMax - tMin;

  const toPercent = (t) => ((t - tMin) / tRange * 100).toFixed(1);

  let expectedBarsHtml = '';
  (expectedRanges || []).forEach(r => {
    expectedBarsHtml += `
      <div class="fs-crossmodal-bar-fill expected" 
           style="left: ${toPercent(r.start)}%; width: ${toPercent(r.end) - toPercent(r.start)}%;"></div>
    `;
  });

  let observedBarsHtml = '';
  (observedRanges || []).forEach(r => {
    observedBarsHtml += `
      <div class="fs-crossmodal-bar-fill observed" 
           style="left: ${toPercent(r.start)}%; width: ${toPercent(r.end) - toPercent(r.start)}%;"></div>
    `;
  });

  const offsetSign = syncOffset > 0 ? '+' : '';
  const offsetColor = isConsistent ? 'var(--fs-green)' : 'var(--fs-red)';

  container.innerHTML = `
    <div class="fs-panel">
      <div class="fs-panel-header">
        <span class="fs-panel-title">Cross-Modal Consistency</span>
      </div>
      <div class="fs-panel-body">
        <div class="fs-crossmodal">
          <div class="fs-crossmodal-row">
            <span class="fs-crossmodal-label">Expected Speech</span>
            <div class="fs-crossmodal-bar-track">${expectedBarsHtml}</div>
          </div>
          <div class="fs-crossmodal-row">
            <span class="fs-crossmodal-label">Observed Audio</span>
            <div class="fs-crossmodal-bar-track">${observedBarsHtml}</div>
          </div>
          <div class="fs-crossmodal-offset">
            <span class="fs-crossmodal-offset-label">Sync Offset</span>
            <span class="fs-crossmodal-offset-value" style="color: ${offsetColor};">
              ${offsetSign}${syncOffset !== null ? syncOffset.toFixed(2) : '—'} sec
            </span>
          </div>
          ${description ? `<div class="fs-crossmodal-description">${description}</div>` : ''}
        </div>
      </div>
    </div>
  `;
}
