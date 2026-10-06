/**
 * FORENSIGHT — Adaptive Routing Component
 * 
 * Shows "WHY THESE TESTS?" — media type, content detected,
 * activated modules, and skipped modules.
 */

export function renderAdaptiveRouting(analysis, container) {
  const { mediaType, contentDetected, activatedModules, skippedModules } = analysis;

  const activeItems = (activatedModules || []).map(m => `
    <div class="fs-routing-module active">
      <span class="fs-routing-module-icon">✓</span>
      <span>${m}</span>
    </div>
  `).join('');

  const skippedItems = (skippedModules || []).map(m => `
    <div class="fs-routing-module skipped">
      <span class="fs-routing-module-icon">○</span>
      <span>${m}</span>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="fs-panel fs-expandable" id="routing-expandable">
      <div class="fs-panel-header fs-expandable-header" id="routing-toggle">
        <span class="fs-panel-title">Why These Tests?</span>
        <span class="fs-expandable-toggle">▼</span>
      </div>
      <div class="fs-expandable-content">
        <div class="fs-panel-body">
          <div class="fs-routing">
            <div class="fs-routing-info">
              <div class="fs-routing-info-item">
                <span class="fs-routing-info-label">Media Type</span>
                <span class="fs-routing-info-value">${(mediaType || 'Unknown').toUpperCase()}</span>
              </div>
              <div class="fs-routing-info-item">
                <span class="fs-routing-info-label">Content Detected</span>
                <span class="fs-routing-info-value">${contentDetected || 'Unknown'}</span>
              </div>
            </div>
            <div>
              <div class="fs-label" style="margin-bottom: var(--fs-space-2);">Activated Forensics</div>
              <div class="fs-routing-modules">${activeItems}</div>
            </div>
            ${skippedItems ? `
              <div>
                <div class="fs-label" style="margin-bottom: var(--fs-space-2);">Not Applicable</div>
                <div class="fs-routing-modules">${skippedItems}</div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  // Toggle expand/collapse
  const toggle = container.querySelector('#routing-toggle');
  const expandable = container.querySelector('#routing-expandable');
  toggle.addEventListener('click', () => {
    expandable.classList.toggle('expanded');
  });
}
