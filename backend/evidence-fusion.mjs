/**
 * FORENSIGHT — Deterministic Forensic Fusion Engine (Phase 2)
 * 
 * Fuses actual measurable image evidence into a calibrated forensic assessment.
 * Distinguishes supporting evidence, contradictory evidence, and limitations.
 * Only reasons over supplied evidence — never invents values.
 */

export function performForensicFusion(evidenceBundle) {
  const { capture = {}, metadata = {}, signals = {}, limitations = [] } = evidenceBundle;
  const strongestEvidence = [];
  const contradictoryEvidence = [];
  const allLimitations = [...limitations];

  let manipulationScore = 0;
  let authenticityScore = 0;
  let signalCount = 0;

  // 1. Noise Consistency Analysis
  const noise = signals.noise || {};
  if (noise.quadrantVarianceRatio != null) {
    signalCount++;
    const qRatio = noise.quadrantVarianceRatio;
    if (qRatio > 1.85) {
      manipulationScore += 2;
      strongestEvidence.push(
        `High localized noise variance across quadrants (ratio ${qRatio.toFixed(2)}): indicates non-uniform sensor noise profile, consistent with spliced or composited regions.`
      );
    } else if (qRatio <= 1.35) {
      authenticityScore += 2;
      contradictoryEvidence.push(
        `Uniform residual noise distribution across quadrants (ratio ${qRatio.toFixed(2)}): consistent with single-sensor physical capture.`
      );
    } else {
      // Moderate variance
      allLimitations.push(
        `Moderate noise variance across quadrants (${qRatio.toFixed(2)}): may reflect lighting gradients or compression artifacts.`
      );
    }
  }

  // 2. Shannon Entropy & Information Density
  const stats = signals.statistics || {};
  if (stats.shannonEntropy != null) {
    signalCount++;
    const entropy = stats.shannonEntropy;
    if (entropy < 4.8) {
      manipulationScore += 1;
      strongestEvidence.push(
        `Abnormally low information entropy (${entropy.toFixed(2)} bits/pixel): indicates synthetic color banding, flat gradients, or heavy generative smoothing.`
      );
    } else if (entropy >= 6.8 && entropy <= 7.9) {
      authenticityScore += 1;
      contradictoryEvidence.push(
        `Natural information entropy (${entropy.toFixed(2)} bits/pixel): reflects complex optical texture and natural scene dynamics.`
      );
    }
  }

  // 3. Compression / Blockiness Anomaly
  const compression = signals.compression || {};
  if (compression.blockinessScore != null) {
    signalCount++;
    const blockiness = compression.blockinessScore;
    if (blockiness > 1.45) {
      manipulationScore += 1.5;
      strongestEvidence.push(
        `Elevated 8x8 block boundary discontinuity (${blockiness.toFixed(2)}): indicates re-compression grid misalignment or local tampering.`
      );
    } else if (blockiness >= 0.95 && blockiness <= 1.25) {
      authenticityScore += 1;
      contradictoryEvidence.push(
        `Consistent compression blockiness profile (${blockiness.toFixed(2)}): aligns with standard single-pass encoding.`
      );
    }
  }

  // 4. Edge Sharpness & Gradients
  const edges = signals.edges || {};
  if (edges.meanGradient != null && edges.edgeDensity != null) {
    signalCount++;
    if (edges.edgeDensity < 0.015 && stats.luminanceStdDev > 40) {
      manipulationScore += 1;
      strongestEvidence.push(
        `Edge density abnormally low (${(edges.edgeDensity * 100).toFixed(1)}%) relative to luminance variance: suggests unnatural boundary blurring or generative blending.`
      );
    } else if (edges.edgeDensity >= 0.04) {
      authenticityScore += 1;
      contradictoryEvidence.push(
        `Natural edge gradient transitions (density ${(edges.edgeDensity * 100).toFixed(1)}%, mean gradient ${edges.meanGradient.toFixed(1)}): consistent with focused optical optics.`
      );
    }
  }

  // 5. Metadata Evaluation
  if (metadata.hasExif && metadata.fields && Object.keys(metadata.fields).length > 0) {
    authenticityScore += 1;
    contradictoryEvidence.push(
      `EXIF camera capture metadata preserved (${metadata.fields.Make || ''} ${metadata.fields.Model || ''}).`
    );
  } else {
    allLimitations.push(
      'EXIF metadata was not embedded or was stripped by web distribution pipeline.'
    );
  }

  // 6. Resolution & Capture Limitations
  if (capture.width < 120 || capture.height < 120) {
    allLimitations.push(
      `Low image resolution (${capture.width}×${capture.height}): high-frequency micro-forensic signals have limited spatial resolution.`
    );
  }

  // Determine Verdict and Confidence
  let verdict;
  let confidence;
  let explanation;

  const totalScore = manipulationScore + authenticityScore;

  if (signalCount < 2) {
    verdict = 'INCONCLUSIVE';
    confidence = 0.35;
    explanation = 'Insufficient measurable forensic signals available to make a definitive assessment.';
  } else if (manipulationScore > authenticityScore && manipulationScore >= 2.5) {
    verdict = 'MANIPULATION_LIKELY';
    confidence = Math.min(0.92, Math.max(0.60, 0.55 + (manipulationScore / (totalScore + 1)) * 0.4));
    explanation = `Multiple independent signals support the manipulation hypothesis, including ${strongestEvidence.length} anomaly indicators.`;
  } else if (authenticityScore > manipulationScore && authenticityScore >= 2.5) {
    verdict = 'AUTHENTICITY_LIKELY';
    confidence = Math.min(0.90, Math.max(0.60, 0.55 + (authenticityScore / (totalScore + 1)) * 0.4));
    explanation = 'Measurable spatial, residual noise, and compression characteristics are consistent with authentic capture.';
  } else {
    verdict = 'INCONCLUSIVE';
    confidence = 0.50;
    explanation = 'Forensic evidence shows conflicting or ambiguous indicators across analytical modules. Independent verification recommended.';
  }

  const recommendedAction = verdict === 'MANIPULATION_LIKELY'
    ? 'Treat media as potentially altered or synthetic. Verify provenance with original publisher.'
    : verdict === 'AUTHENTICITY_LIKELY'
    ? 'Signals consistent with natural capture. Note that forensic evaluation only covers container and pixel characteristics, not legal validity.'
    : 'Evidence inconclusive. Perform cross-source verification or inspect high-resolution original.';

  return {
    verdict,
    confidence: Number(confidence.toFixed(2)),
    strongest_evidence: strongestEvidence,
    contradictory_evidence: contradictoryEvidence,
    explanation,
    limitations: allLimitations,
    recommended_action: recommendedAction,
    metrics_summary: {
      manipulationScore,
      authenticityScore,
      signalsEvaluated: signalCount,
    },
  };
}
