/**
 * FORENSIGHT — Main Application
 * 
 * Orchestrates the landing page and analysis view.
 * Manages demo case selection and component rendering.
 */

import './style.css';
import { DEMO_CASES } from './models/demo-data.js';
import { VerdictStatus, MediaType } from './models/forensic-data.js';

// Components
import { renderVerdictCore } from './components/VerdictCore.js';
import { renderEvidenceConstellation } from './components/EvidenceConstellation.js';
import { renderEvidenceMatrix } from './components/EvidenceMatrix.js';
import { renderSignalBars } from './components/SignalBars.js';
import { renderExplanationPanel } from './components/ExplanationPanel.js';
import { renderStabilityProfile } from './components/StabilityProfile.js';
import { renderInvestigationFlow } from './components/InvestigationFlow.js';
import { renderForensicTimeline } from './components/ForensicTimeline.js';
import { renderCrossModalView } from './components/CrossModalView.js';
import { renderAdaptiveRouting } from './components/AdaptiveRouting.js';
import { renderCaseSummary } from './components/CaseSummary.js';
import { renderMediaViewer } from './components/MediaViewer.js';

// ─── State ──────────────────────────────────────────────────────
let currentView = 'landing'; // 'landing' | 'analysis'
let currentAnalysis = null;

const app = document.getElementById('app');

// ─── Landing Page ───────────────────────────────────────────────
function renderLanding() {
  currentView = 'landing';
  currentAnalysis = null;

  const flowSteps = ['Media', 'Evidence', 'Forensic Reasoning', 'Verdict'];

  const flowHtml = flowSteps.map((step, i) => {
    let html = `<div class="fs-landing-flow-step">${step}</div>`;
    if (i < flowSteps.length - 1) {
      html += `<span class="fs-landing-flow-arrow">→</span>`;
    }
    return html;
  }).join('');

  const cardsHtml = DEMO_CASES.map(c => `
    <div class="fs-demo-card" data-case-id="${c.id}" data-status="${c.status}" role="button" tabindex="0">
      <div class="fs-demo-card-title">${c.title}</div>
      <div class="fs-demo-card-subtitle">${c.subtitle}</div>
      <div class="fs-demo-card-action">Run Analysis →</div>
    </div>
  `).join('');

  app.innerHTML = `
    <div class="fs-landing">
      <div class="fs-landing-hero">
        <div class="fs-landing-logo">FOREN<span class="logo-accent">SIGHT</span></div>
        <div class="fs-landing-tagline">Verify before you trust.</div>
        <div class="fs-landing-subtitle">Adaptive Evidence-Driven Multimodal Digital Forensics</div>
      </div>

      <div class="fs-landing-flow">
        ${flowHtml}
      </div>

      <div style="text-align: center; margin-bottom: var(--fs-space-6);">
        <span class="fs-demo-badge">DEMO MODE</span>
        <p style="font-size: var(--fs-text-sm); color: var(--fs-text-tertiary); margin-top: var(--fs-space-2);">
          Select a case to view the forensic analysis
        </p>
      </div>

      <div class="fs-demo-grid">
        ${cardsHtml}
      </div>

      <div style="text-align: center; margin-top: var(--fs-space-8); padding-top: var(--fs-space-6); border-top: 1px solid var(--fs-border-subtle); width: 100%; max-width: 600px;">
        <div style="font-size: var(--fs-text-xs); color: var(--fs-text-disabled); letter-spacing: var(--fs-tracking-wider); text-transform: uppercase;">
          FORENSIGHT · Digital Forensics Investigation System
        </div>
      </div>
    </div>
  `;

  // Bind card clicks
  document.querySelectorAll('.fs-demo-card').forEach(card => {
    const handler = () => {
      const caseId = card.dataset.caseId;
      const demoCase = DEMO_CASES.find(c => c.id === caseId);
      if (demoCase) {
        runAnalysis(demoCase);
      }
    };
    card.addEventListener('click', handler);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler();
      }
    });
  });
}


// ─── Analysis View ──────────────────────────────────────────────
function runAnalysis(demoCase) {
  currentView = 'analysis';
  
  // Show scanning state first
  app.innerHTML = `
    <div class="fs-analysis">
      <div class="fs-analysis-header">
        <div class="fs-header-left">
          <div class="fs-header-logo">FOREN<span class="logo-accent">SIGHT</span></div>
          <div class="fs-header-divider"></div>
          <div class="fs-header-file">${demoCase.subtitle}</div>
        </div>
      </div>
      <div style="text-align: center; padding: var(--fs-space-16) 0;">
        <div style="font-size: var(--fs-text-xs); font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--fs-accent); margin-bottom: var(--fs-space-4);">
          <span class="fs-status-dot running" style="margin-right: var(--fs-space-2);"></span>
          Analyzing media...
        </div>
        <div class="fs-scan-progress" style="width: 200px; height: 2px; background: var(--fs-bg-tertiary); border-radius: 1px; margin: 0 auto; overflow: hidden;">
          <div style="width: 0%; height: 100%; background: var(--fs-accent); border-radius: 1px; animation: fs-progress 1.5s ease-out forwards;"></div>
        </div>
      </div>
    </div>
    <style>
      @keyframes fs-progress {
        0% { width: 0%; }
        60% { width: 80%; }
        100% { width: 100%; }
      }
    </style>
  `;

  // Simulate analysis delay, then render results
  setTimeout(() => {
    currentAnalysis = demoCase.factory();
    renderAnalysisView(currentAnalysis, demoCase);
  }, 1600);
}

function renderAnalysisView(analysis, demoCase) {
  const isVideo = analysis.mediaType === MediaType.VIDEO;
  const isAudio = analysis.mediaType === MediaType.AUDIO;
  const hasTimeline = isVideo || isAudio;
  const hasCrossModal = isVideo && analysis.crossModalSync;

  // Build the full analysis layout
  app.innerHTML = `
    <div class="fs-analysis">
      <!-- Header -->
      <div class="fs-analysis-header">
        <div class="fs-header-left">
          <div class="fs-header-logo">FOREN<span class="logo-accent">SIGHT</span></div>
          <div class="fs-header-divider"></div>
          <div class="fs-header-file">${analysis.fileName || demoCase.subtitle}</div>
          ${analysis.isDemo ? '<span class="fs-demo-badge">DEMO</span>' : ''}
        </div>
        <button class="fs-back-btn" id="back-btn">← Back</button>
      </div>

      <!-- Row 1: Verdict + Constellation -->
      <div class="fs-analysis-grid">
        <div class="fs-analysis-row fs-analysis-row-2">
          <div id="slot-verdict"></div>
          <div id="slot-constellation"></div>
        </div>

        <!-- Row 2: Media Viewer + Signal Bars -->
        <div class="fs-analysis-row fs-analysis-row-2">
          <div id="slot-media-viewer"></div>
          <div id="slot-signal-bars"></div>
        </div>

        <!-- Row 3: Evidence Matrix + Explanation -->
        <div class="fs-analysis-row fs-analysis-row-2">
          <div id="slot-matrix"></div>
          <div id="slot-explanation"></div>
        </div>

        <!-- Row 4: Timeline (video/audio only) -->
        ${hasTimeline ? '<div id="slot-timeline"></div>' : ''}

        <!-- Row 5: Cross-Modal (video only) -->
        ${hasCrossModal ? '<div id="slot-crossmodal"></div>' : ''}

        <!-- Row 6: Stability + Investigation Flow -->
        <div class="fs-analysis-row fs-analysis-row-2">
          <div id="slot-stability"></div>
          <div id="slot-investigation"></div>
        </div>

        <!-- Row 7: Adaptive Routing -->
        <div id="slot-routing"></div>

        <!-- Row 8: Case Summary -->
        <div id="slot-summary"></div>
      </div>
    </div>
  `;

  // Back button
  document.getElementById('back-btn').addEventListener('click', renderLanding);

  // Render all components
  renderVerdictCore(analysis, document.getElementById('slot-verdict'));
  renderEvidenceConstellation(analysis, document.getElementById('slot-constellation'));
  renderMediaViewer(analysis, document.getElementById('slot-media-viewer'));
  renderSignalBars(analysis, document.getElementById('slot-signal-bars'));
  renderEvidenceMatrix(analysis, document.getElementById('slot-matrix'));
  renderExplanationPanel(analysis, document.getElementById('slot-explanation'));

  if (hasTimeline) {
    renderForensicTimeline(analysis, document.getElementById('slot-timeline'));
  }

  if (hasCrossModal) {
    renderCrossModalView(analysis, document.getElementById('slot-crossmodal'));
  }

  renderStabilityProfile(analysis, document.getElementById('slot-stability'));
  renderInvestigationFlow(analysis, document.getElementById('slot-investigation'));
  renderAdaptiveRouting(analysis, document.getElementById('slot-routing'));
  renderCaseSummary(analysis, document.getElementById('slot-summary'));

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


// ─── Initialize ─────────────────────────────────────────────────
renderLanding();
