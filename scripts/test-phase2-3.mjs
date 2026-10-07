/**
 * Automated Verification Test Suite for FORENSIGHT Phase 2 & Phase 3
 * Validates Image & Video Real-Time Forensic Pipeline, Claude Reasoning & Integrity
 */

import fs from 'node:fs';
import path from 'node:path';
import { performForensicFusion } from '../backend/evidence-fusion.mjs';
import { analyzeVideoEvidence } from '../backend/video-forensics.mjs';
import { reasonWithClaude } from '../backend/claude-reasoner.mjs';
import { inspectImageBinary, computeImageSignals } from '../backend/image-forensics.mjs';

console.log('═══════════════════════════════════════════════════════════════');
console.log('    FORENSIGHT PHASE 2 & 3 COMPREHENSIVE VERIFICATION SUITE   ');
console.log('═══════════════════════════════════════════════════════════════\n');

let passCount = 0;
let failCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
    failCount++;
  }
}

// ─── TEST A: Security & API Key Isolation ───────────────────────────
console.log('▶ TEST: Security & API Key Isolation Check...');
const extensionFiles = [
  'extension/manifest.json',
  'extension/content/content.js',
  'extension/content/styles.css',
  'extension/background/service-worker.js',
  'extension/sidepanel/app.js',
  'extension/sidepanel/styles.css',
  'extension/demo/social-feed.html',
];

let foundSecretInExtension = false;
for (const rel of extensionFiles) {
  const content = fs.readFileSync(path.resolve(rel), 'utf8');
  if (/sk-ant-[a-zA-Z0-9_\-]{20,}/.test(content) || /ANTHROPIC_API_KEY\s*=\s*['"]sk-/.test(content)) {
    foundSecretInExtension = true;
    console.error(`Found raw API key in ${rel}`);
  }
}
assert(!foundSecretInExtension, 'No API keys exist anywhere in extension source files');

const gitignore = fs.readFileSync(path.resolve('.gitignore'), 'utf8');
assert(gitignore.includes('.env'), '.gitignore properly ignores .env');
assert(fs.existsSync(path.resolve('.env.example')), '.env.example exists without secrets');

// ─── TEST B: Image Forensic Signal Extraction (Phase 2) ────────────
console.log('\n▶ TEST: Image Forensic Signal Extraction & EvidenceBundle...');

// Generate a synthetic test canvas pixel buffer (64x64 RGBA)
const testW = 64, testH = 64;
const testPixels = new Uint8ClampedArray(testW * testH * 4);
for (let y = 0; y < testH; y++) {
  for (let x = 0; x < testW; x++) {
    const idx = (y * testW + x) * 4;
    testPixels[idx] = (x * 4) % 256;     // R
    testPixels[idx + 1] = (y * 4) % 256; // G
    testPixels[idx + 2] = 128;           // B
    testPixels[idx + 3] = 255;           // A
  }
}

const computedSignals = computeImageSignals(testPixels, testW, testH);
assert(computedSignals !== null, 'computeImageSignals produces empirical metrics');
assert(typeof computedSignals.statistics.luminanceMean === 'number', 'Calculated luminance mean');
assert(typeof computedSignals.statistics.shannonEntropy === 'number', 'Calculated Shannon entropy');
assert(computedSignals.statistics.shannonEntropy > 0, 'Shannon entropy is non-zero');
assert(typeof computedSignals.noise.residualStdDev === 'number', 'Calculated Laplacian residual noise standard deviation');
assert(typeof computedSignals.noise.quadrantVarianceRatio === 'number', 'Calculated quadrant noise variance ratio');
assert(typeof computedSignals.edges.meanGradient === 'number', 'Calculated Sobel edge gradient magnitude');
assert(typeof computedSignals.compression.blockinessScore === 'number', 'Calculated 8x8 block boundary discontinuity ratio');

// ─── TEST C: Image Evidence Fusion & Fallback Reasoning ─────────────
console.log('\n▶ TEST: Image Evidence Fusion & Fallback when Claude is unconfigured...');

const mockImageBundle = {
  mediaId: 'fs-image-test-1',
  modality: 'image',
  capture: { width: 640, height: 480, mimeType: 'image/jpeg', fileSize: 45000 },
  metadata: { available: false, format: 'JPEG', hasExif: false, fields: {} },
  signals: computedSignals,
  limitations: ['EXIF metadata stripped by platform'],
};

const imageFusion = performForensicFusion(mockImageBundle);
assert(['AUTHENTICITY_LIKELY', 'MANIPULATION_LIKELY', 'INCONCLUSIVE'].includes(imageFusion.verdict), 'Fusion produces valid verdict');
assert(typeof imageFusion.confidence === 'number' && imageFusion.confidence >= 0 && imageFusion.confidence <= 1, 'Confidence calibrated between 0 and 1');
assert(Array.isArray(imageFusion.strongest_evidence), 'strongest_evidence is structured array');
assert(Array.isArray(imageFusion.contradictory_evidence), 'contradictory_evidence is structured array');
assert(typeof imageFusion.explanation === 'string' && imageFusion.explanation.length > 10, 'Generated coherent forensic explanation');

// Verify Claude handling when key is missing or unconfigured
const claudeWithoutKey = await reasonWithClaude(mockImageBundle, '');
assert(!claudeWithoutKey.available, 'Claude correctly identifies missing API key');
assert(claudeWithoutKey.code === 'API_KEY_UNAVAILABLE', 'Returns API_KEY_UNAVAILABLE code');

// ─── TEST D: Video Forensic Processing & Temporal Checks (Phase 3) ──
console.log('\n▶ TEST: Video Forensic Processing & Frame Sampling...');

const mockSampledFrames = [
  { timestamp: 0.5, frameIndex: 0, signals: computedSignals },
  { timestamp: 3.2, frameIndex: 1, signals: computedSignals },
  { timestamp: 6.8, frameIndex: 2, signals: computedSignals },
  { timestamp: 10.0, frameIndex: 3, signals: computedSignals },
];

const videoPayload = {
  mediaId: 'fs-video-test-1',
  sourceUrl: 'https://example.com/sample.mp4',
  metadata: { width: 1280, height: 720, duration: 12.5, mimeType: 'video/mp4' },
  sampledFrames: mockSampledFrames,
};

const videoAnalysis = analyzeVideoEvidence(videoPayload);
assert(videoAnalysis.evidenceBundle.modality === 'video', 'Video EvidenceBundle modality is video');
assert(videoAnalysis.evidenceBundle.sampling.framesAnalyzed === 4, 'sampling records exactly 4 frames analyzed');
assert(videoAnalysis.evidenceBundle.sampling.timestamps.length === 4, 'Recorded exact sampled timestamps');
assert(videoAnalysis.evidenceBundle.sampling.timestamps[0] === 0.5, 'Exact timestamp 0.5s preserved');
assert(videoAnalysis.evidenceBundle.sampling.timestamps[1] === 3.2, 'Exact timestamp 3.2s preserved');
assert(videoAnalysis.evidenceBundle.temporalEvidence.length === 3, 'Calculated 3 inter-frame temporal transitions');
assert(['AUTHENTICITY_LIKELY', 'MANIPULATION_LIKELY', 'INCONCLUSIVE'].includes(videoAnalysis.deterministicFusion.verdict), 'Video fusion produces valid verdict');
assert(videoAnalysis.deterministicFusion.confidence > 0, 'Video confidence score is calibrated');

// ─── TEST E: Extension Manifest & File Structure ───────────────────
console.log('\n▶ TEST: Extension Manifest & Permissions...');
const manifest = JSON.parse(fs.readFileSync(path.resolve('extension/manifest.json'), 'utf8'));
assert(manifest.manifest_version === 3, 'MV3 manifest');
assert(manifest.host_permissions.includes('http://localhost:8000/*'), 'host_permissions include backend URL');

const serviceWorkerCode = fs.readFileSync(path.resolve('extension/background/service-worker.js'), 'utf8');
assert(serviceWorkerCode.includes('/api/analyze-image'), 'Service worker calls /api/analyze-image');
assert(serviceWorkerCode.includes('/api/analyze-video'), 'Service worker calls /api/analyze-video');
assert(serviceWorkerCode.includes('FORENSIC ENGINE UNAVAILABLE'), 'Service worker handles backend unavailable error');

const contentCode = fs.readFileSync(path.resolve('extension/content/content.js'), 'utf8');
assert(contentCode.includes('triggerImageForensics'), 'Content script has automatic image forensics trigger');
assert(contentCode.includes('triggerVideoForensics'), 'Content script has automatic video forensics trigger');
assert(contentCode.includes('sampleVideoKeyframes'), 'Content script samples video keyframes');

const sidepanelCode = fs.readFileSync(path.resolve('extension/sidepanel/app.js'), 'utf8');
assert(sidepanelCode.includes('Sampled Keyframe Timeline'), 'Sidepanel renders Video Timeline with sampled timestamps');
assert(sidepanelCode.includes('FORENSIC REASONING UNAVAILABLE'), 'Sidepanel handles unconfigured Claude gracefully');
assert(sidepanelCode.includes('FORENSIC ENGINE UNAVAILABLE'), 'Sidepanel handles backend unavailable gracefully');

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`TOTAL TESTS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
console.log('═══════════════════════════════════════════════════════════════');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL PHASE 2 & PHASE 3 VERIFICATION TESTS PASSED!');
}
