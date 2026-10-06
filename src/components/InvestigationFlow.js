/**
 * FORENSIGHT — Investigation Flow Component
 * 
 * Vertical timeline showing the forensic investigation stages.
 * Each stage: completed (✓), running (●), pending, or unavailable (—).
 */

import { StageLabels } from '../models/forensic-data.js';

export function renderInvestigationFlow(analysis, container) {
  const { investigationFlow } = analysis;

  if (!investigationFlow || investigationFlow.length === 0) {
    container.innerHTML = `
      <div class="fs-panel">
        <div class="fs-panel-header">
          <span class="fs-panel-title">Investigation Flow</span>
        </div>
        <div class="fs-panel-body" style="text-align:center; color: var(--fs-text-tertiary); padding: var(--fs-space-6);">
          Awaiting analysis
        </div>
      </div>
    `;
    return;
  }

  const steps = investigationFlow.map(step => {
    const label = StageLabels[step.stage] || step.stage;
    const markerContent = step.status === 'completed' ? '✓' : 
                          step.status === 'running' ? '●' : 
                          step.status === 'unavailable' ? '—' : '';
    
    return `
      <div class="fs-flow-step ${step.status}">
        <div class="fs-flow-marker">${markerContent}</div>
        <span class="fs-flow-label">${label}</span>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="fs-panel">
      <div class="fs-panel-header">
        <span class="fs-panel-title">Investigation Flow</span>
      </div>
      <div class="fs-panel-body">
        <div class="fs-investigation-flow">
          ${steps}
        </div>
      </div>
    </div>
  `;
}
