"""
FORENSIGHT — Deterministic Evidence Fusion Engine
=================================================

Synthesizes empirical signal measurements from Forensic ML and high-level
multimodal observations from Google Gemini into a calibrated decision.

Strict Rules:
1. Gemini AI_GENERATED_LIKELY + forensic features supporting synthetic/manipulation -> AI_GENERATED
2. Gemini MANIPULATION_LIKELY + forensic features supporting manipulation -> MANIPULATED
3. Gemini REAL_LIKELY + no significant forensic anomaly -> REAL
4. Conflicting signals, weak evidence, or unavailable primary evidence -> INCONCLUSIVE

Guarantees:
- Never invents arbitrary confidence percentages.
- Clearly states agreement, conflict, evidentiary status, and rationale.
- Conforms strictly to the fusion contract in schemas/evidence-bundle.json.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple


def evaluate_forensic_anomalies(forensic_features: Dict[str, Any]) -> Tuple[List[str], List[str]]:
    """
    Evaluates empirical signal features for physical or structural anomalies.

    Returns:
        (anomalies_detected, consistent_signals)
    """
    anomalies: List[str] = []
    consistent: List[str] = []

    noise = forensic_features.get("noise", {})
    freq = forensic_features.get("frequency", {})
    edges = forensic_features.get("edges", {})
    texture = forensic_features.get("texture", {})
    jpeg = forensic_features.get("jpeg", {})

    # 1. Noise Quadrant Uniformity (measures spatial consistency of camera sensor PRNU noise)
    uniformity = noise.get("quadrant_variance_uniformity")
    if uniformity is not None:
        if uniformity < 0.35:
            anomalies.append(
                f"Severe noise residual variance disparity across spatial quadrants (uniformity: {uniformity:.2f} < 0.35), indicating localized compositing or inpainting."
            )
        elif uniformity >= 0.50:
            consistent.append(
                f"Spatially stationary noise residual variance across quadrants (uniformity: {uniformity:.2f}), consistent with a single capture sensor."
            )

    # 2. 2D FFT Spectral Distribution & Grid Peaks (GAN / Diffusion upsampling artifacts)
    grid_peak = freq.get("grid_peak_energy")
    if grid_peak is not None and grid_peak > 150.0:
        anomalies.append(
            f"Periodic high-frequency spectral grid energy spike detected (peak-to-median ratio: {grid_peak:.1f}), characteristic of generative transposed convolution upsampling."
        )

    decay_rate = freq.get("high_frequency_decay_rate")
    if decay_rate is not None:
        if decay_rate < 0.8 or decay_rate > 3.8:
            anomalies.append(
                f"Unnatural spectral power-law decay slope ({decay_rate:.2f}), deviating from expected natural optical decay."
            )
        elif 1.4 <= decay_rate <= 2.8:
            consistent.append(
                f"Natural optical 2D Fourier spectral decay rate ({decay_rate:.2f}), conforming to organic camera optics."
            )

    # 3. Boundary & Seam Discontinuity (Splicing / Cut-and-paste indicators)
    bdi = edges.get("boundary_discontinuity_index")
    if bdi is not None:
        if bdi > 2.2 or bdi < 0.25:
            anomalies.append(
                f"Border-to-interior edge gradient discontinuity ({bdi:.2f}), indicating potential edge blending or seam carving."
            )
        elif 0.7 <= bdi <= 1.4:
            consistent.append(
                f"Coherent gradient distribution across image boundaries (index: {bdi:.2f})."
            )

    # 4. Texture & Shannon Entropy
    entropy = texture.get("shannon_entropy")
    if entropy is not None:
        if entropy < 2.0:
            anomalies.append(
                f"Abnormally low Shannon entropy ({entropy:.2f} bits), indicating artificial smoothness or synthetic flat-fill."
            )
        elif entropy >= 6.0:
            consistent.append(
                f"Rich grayscale information entropy ({entropy:.2f} bits), typical of complex real-world photographic scenes."
            )

    # 5. JPEG 8x8 Grid Blockiness
    blockiness = jpeg.get("blockiness_8x8_score")
    if blockiness is not None and blockiness > 0.30:
        anomalies.append(
            f"Elevated 8x8 block boundary discontinuity score ({blockiness:.4f}), consistent with recompression or grid misalignment."
        )

    return anomalies, consistent


def fuse_evidence(
    forensic_features: Dict[str, Any],
    gemini_result: Dict[str, Any],
    modality: str = "IMAGE",
) -> Dict[str, Any]:
    """
    Fuses empirical Forensic ML measurements and Gemini multimodal reasoning.

    Args:
        forensic_features: Dictionary matching forensic_features in schemas/evidence-bundle.json.
        gemini_result: Dictionary matching gemini in schemas/evidence-bundle.json.
        modality: Media modality (default "IMAGE").

    Returns:
        Dictionary conforming to schemas/evidence-bundle.json under `fusion`:
        {
            "agreement": bool,
            "conflict": bool,
            "final_verdict": "REAL" | "MANIPULATED" | "AI_GENERATED" | "INCONCLUSIVE",
            "status": "SUFFICIENT_EVIDENCE" | "CONFLICTING_EVIDENCE" | "INSUFFICIENT_EVIDENCE" | "ANALYSIS_UNAVAILABLE",
            "reasons": list[str]
        }
    """
    gemini_available = bool(gemini_result.get("available", False))
    gemini_assessment = str(gemini_result.get("assessment", "INCONCLUSIVE")).strip().upper()
    gemini_observations = gemini_result.get("observations", [])
    gemini_indicators = gemini_result.get("indicators", [])

    anomalies, consistent_signals = evaluate_forensic_anomalies(forensic_features)
    has_anomalies = len(anomalies) > 0
    has_consistent = len(consistent_signals) > 0

    reasons: List[str] = []
    agreement = False
    conflict = False
    final_verdict = "INCONCLUSIVE"
    status = "INSUFFICIENT_EVIDENCE"

    # Case 1: Gemini indicates AI Generation
    if gemini_available and gemini_assessment == "AI_GENERATED_LIKELY":
        if has_anomalies:
            final_verdict = "AI_GENERATED"
            status = "SUFFICIENT_EVIDENCE"
            agreement = True
            conflict = False
            reasons.append("Gemini multimodal reasoning identified visual AI synthesis indicators.")
            reasons.extend(anomalies[:2])
            reasons.append("Both independent analysis pipelines corroborate synthetic generation.")
        elif has_consistent:
            final_verdict = "INCONCLUSIVE"
            status = "CONFLICTING_EVIDENCE"
            agreement = False
            conflict = True
            reasons.append("Tension: Gemini suspected generative visual features, but empirical signal features exhibit natural camera characteristics.")
            reasons.extend(consistent_signals[:1])
        else:
            final_verdict = "INCONCLUSIVE"
            status = "INSUFFICIENT_EVIDENCE"
            reasons.append("Gemini suspected AI generation, but empirical forensic signal evidence was insufficient to independently corroborate.")

    # Case 2: Gemini indicates Localized Manipulation / Tampering
    elif gemini_available and gemini_assessment == "MANIPULATION_LIKELY":
        if has_anomalies:
            final_verdict = "MANIPULATED"
            status = "SUFFICIENT_EVIDENCE"
            agreement = True
            conflict = False
            reasons.append("Gemini multimodal reasoning identified visual tampering or compositing boundaries.")
            reasons.extend(anomalies[:2])
            reasons.append("Both pipelines independently corroborate localized manipulation.")
        elif has_consistent:
            final_verdict = "INCONCLUSIVE"
            status = "CONFLICTING_EVIDENCE"
            agreement = False
            conflict = True
            reasons.append("Tension: Gemini noted visual inconsistencies, but empirical noise residuals remain spatially uniform.")
        else:
            final_verdict = "INCONCLUSIVE"
            status = "INSUFFICIENT_EVIDENCE"
            reasons.append("Gemini suspected manipulation, but signal-level feature evidence is insufficient to verify.")

    # Case 3: Gemini indicates Real / Authentic
    elif gemini_available and gemini_assessment == "REAL_LIKELY":
        if not has_anomalies and has_consistent:
            final_verdict = "REAL"
            status = "SUFFICIENT_EVIDENCE"
            agreement = True
            conflict = False
            reasons.append("Gemini multimodal reasoning observed coherent physical lighting and geometry.")
            reasons.extend(consistent_signals[:2])
            reasons.append("No significant empirical signal anomalies detected across noise, frequency, or edge domains.")
        elif has_anomalies:
            final_verdict = "INCONCLUSIVE"
            status = "CONFLICTING_EVIDENCE"
            agreement = False
            conflict = True
            reasons.append("Tension: Gemini observed plausible physical scene lighting, but empirical signal analysis detected underlying anomalies.")
            reasons.extend(anomalies[:2])
        else:
            final_verdict = "INCONCLUSIVE"
            status = "INSUFFICIENT_EVIDENCE"
            reasons.append("Gemini observed realistic visual qualities, but forensic signal density is limited.")

    # Case 4: Gemini Inconclusive or Gemini Unavailable
    else:
        agreement = False
        conflict = False
        final_verdict = "INCONCLUSIVE"

        if not gemini_available:
            status = "ANALYSIS_UNAVAILABLE"
            reasons.append("Gemini multimodal reasoning was unavailable (API key missing or authentication failed).")
            if has_anomalies:
                reasons.append("Empirical signal features noted anomalies, but independent multimodal confirmation is absent:")
                reasons.extend(anomalies[:2])
            elif has_consistent:
                reasons.append("Empirical signal features are consistent with standard camera capture, but multimodal verification is absent.")
            else:
                reasons.append("Single-signal evidence alone cannot establish a conclusive forensic verdict.")
        else:
            status = "INSUFFICIENT_EVIDENCE"
            reasons.append("Gemini multimodal assessment is inconclusive due to ambiguous visual cues or platform compression.")
            if has_anomalies:
                reasons.extend(anomalies[:1])
            if has_consistent:
                reasons.extend(consistent_signals[:1])

    return {
        "agreement": agreement,
        "conflict": conflict,
        "final_verdict": final_verdict,
        "status": status,
        "reasons": reasons,
    }
