/**
 * FORENSIGHT — Media Viewer Component
 * 
 * Displays media with optional heatmap overlay for suspicious regions.
 * Supports Original / Evidence / Heatmap toggle modes.
 */

export function renderMediaViewer(analysis, container) {
  const { suspiciousRegions, mediaType, fileName } = analysis;

  const hasRegions = suspiciousRegions && suspiciousRegions.length > 0;
  
  // Build heatmap overlay regions
  let regionsHtml = '';
  if (hasRegions) {
    regionsHtml = suspiciousRegions.map((r, i) => `
      <div class="fs-heatmap-region" style="
        left: ${r.x * 100}%;
        top: ${r.y * 100}%;
        width: ${r.width * 100}%;
        height: ${r.height * 100}%;
        opacity: ${0.4 + r.intensity * 0.5};
      " title="Region ${i + 1}: ${Math.round(r.intensity * 100)}% intensity"></div>
    `).join('');
  }

  container.innerHTML = `
    <div class="fs-panel fs-media-viewer">
      <div class="fs-media-viewer-controls">
        <button class="fs-btn active" data-view="original" id="mv-btn-original">Original</button>
        <button class="fs-btn" data-view="evidence" id="mv-btn-evidence">Evidence</button>
        <button class="fs-btn" data-view="heatmap" id="mv-btn-heatmap">Heatmap</button>
        <span style="flex:1;"></span>
        <span style="font-size: var(--fs-text-xs); color: var(--fs-text-tertiary); align-self: center;">
          ${fileName || 'No file'}
        </span>
      </div>
      <div class="fs-media-viewer-canvas" id="mv-canvas">
        <div class="fs-media-viewer-placeholder">
          <div style="margin-bottom: var(--fs-space-2); font-size: var(--fs-text-lg); opacity: 0.4;">◎</div>
          <div>Media preview</div>
          <div style="font-size: var(--fs-text-xs); margin-top: var(--fs-space-1); color: var(--fs-text-disabled);">${(mediaType || 'unknown').toUpperCase()} · DEMO MODE</div>
        </div>
        <div class="fs-heatmap-overlay" id="mv-heatmap" style="display: none;">
          ${hasRegions ? regionsHtml : '<div class="fs-heatmap-unavailable">Localization unavailable</div>'}
        </div>
        <div class="fs-heatmap-overlay" id="mv-evidence" style="display: none;">
          ${hasRegions ? regionsHtml : '<div class="fs-heatmap-unavailable">Localization unavailable</div>'}
        </div>
      </div>
    </div>
  `;

  // View toggle
  const btnOriginal = container.querySelector('#mv-btn-original');
  const btnEvidence = container.querySelector('#mv-btn-evidence');
  const btnHeatmap = container.querySelector('#mv-btn-heatmap');
  const heatmapOverlay = container.querySelector('#mv-heatmap');
  const evidenceOverlay = container.querySelector('#mv-evidence');

  const buttons = [btnOriginal, btnEvidence, btnHeatmap];

  function setView(view) {
    buttons.forEach(b => b.classList.remove('active'));
    heatmapOverlay.style.display = 'none';
    evidenceOverlay.style.display = 'none';

    if (view === 'heatmap') {
      btnHeatmap.classList.add('active');
      heatmapOverlay.style.display = 'block';
    } else if (view === 'evidence') {
      btnEvidence.classList.add('active');
      evidenceOverlay.style.display = 'block';
    } else {
      btnOriginal.classList.add('active');
    }
  }

  btnOriginal.addEventListener('click', () => setView('original'));
  btnEvidence.addEventListener('click', () => setView('evidence'));
  btnHeatmap.addEventListener('click', () => setView('heatmap'));
}
