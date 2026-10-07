# FORENSIGHT Integration Architecture & EvidenceBundle Contract

## 1. Overview: Why EvidenceBundle Exists

Single-model black-box forensics systems consistently fail in adversarial and real-world environments because they output opaque, uncalibrated confidence scores (e.g. *"94% Fake"*). In practice, web media undergoes aggressive transcoding, platform compression, downsampling, and filtering that confuse monolithic classifiers.

The **EvidenceBundle** contract ([`schemas/evidence-bundle.json`](../schemas/evidence-bundle.json)) defines a standardized, cross-modal interoperability interface unifying two fundamentally distinct, complementary analytical paradigms:

```
                          MEDIA ACQUIRED FROM DOM
                        (Image, Video, or Audio)
                                   │
                 ┌─────────────────┴─────────────────┐
                 ▼                                   ▼
      FORENSIGHT FORENSIC ML                 GOOGLE GEMINI
    (Empirical Signal Analysis)       (Multimodal Semantic Reasoning)
                 │                                   │
                 │  • Residual noise & PRNU          │  • Physical lighting plausibility
                 │  • 2D FFT / DCT spectra           │  • Semantic & anatomical logic
                 │  • Quantization & blockiness      │  • Perspective & shadow geometry
                 │  • Edge gradients & entropy       │  • Cross-modal temporal context
                 │                                   │
                 └─────────────────┬─────────────────┘
                                   ▼
                           DECISION FUSION
                 (Agreement, Conflict & Calibrated Verdict)
                                   │
                                   ▼
                         FINAL EVIDENCE BUNDLE
```

By decoupling low-level pixel/signal feature extraction from high-level multimodal semantic reasoning, the system prevents hallucinations, isolates contradictory evidence, and preserves an audit-ready chain of forensic custody.

---

## 2. Component Responsibilities

### 2.1 Forensic ML Pipeline (`forensic_ml`)
The **Forensic ML Pipeline** is responsible for deterministic, mathematical, and signal-level measurements extracted directly from raw pixel arrays, spectral transforms, or audio waveforms:
- **Spatial Residuals & Noise**: Photo-Response Non-Uniformity (PRNU) sensor fingerprinting, quadrant noise variance uniformity, and additive noise distributions.
- **Frequency & Spectral Transforms**: 2D Discrete Fourier (FFT) and Discrete Cosine (DCT) spectral energy decay, revealing high-frequency artifacts left by diffusion upsamplers or GAN generators.
- **Compression & Quantization**: JPEG 8x8 block boundary discontinuities, quantization table identification, and double-compression traces.
- **Edge & Texture Integrity**: Sobel gradient distributions, boundary seam carving anomalies, and Shannon entropy.
- **Metadata & Provenance**: EXIF integrity, container headers, and cryptographic C2PA Content Credentials.
- **Probabilistic Calibration**: Outputs calibrated posterior probabilities across `real`, `manipulated`, and `ai_generated`.

### 2.2 Google Gemini Multimodal Analyzer (`gemini`)
**Google Gemini** operates at the semantic, physical, and contextual reasoning layer:
- **Physical Plausibility**: Verifies whether illumination angles, shadow orientations, reflection rays, and specular highlights follow coherent laws of physics.
- **Anatomical & Structural Logic**: Evaluates human biometrics, limb articulations, facial symmetry, and non-Euclidean geometric distortions.
- **Contextual Incongruities**: Identifies semantic impossibilities (e.g. historical anachronisms, nonsensical text in backgrounds).
- **Audio-Visual & Temporal Plausibility**: For video and audio, cross-examines lip-sync coherence, speech cadence, and environmental acoustic consistency.
- **Limitations Transparency**: Explicitly records perceptual constraints (e.g., low resolution, heavy compression artifacts, occlusion).

### 2.3 Decision Fusion (`fusion`)
The **Fusion Layer** synthesizes the empirical ML features and Gemini's semantic reasoning:
- **Agreement Verification (`agreement: true/false`)**: Confirms whether both engines independently point to concordant conclusions.
- **Conflict Detection (`conflict: true/false`)**: Detects and highlights disagreements (e.g., Gemini suspects manipulation due to unusual lighting, but Forensic ML confirms authentic camera sensor PRNU noise; or Forensic ML flags compression artifacts that Gemini confirms are harmless compression rather than synthesis).
- **Evidentiary Status (`status`)**:
  - `SUFFICIENT_EVIDENCE`: Both engines provide corroborated data meeting the required forensic threshold.
  - `CONFLICTING_EVIDENCE`: Signals actively contradict each other, requiring expert review.
  - `INSUFFICIENT_EVIDENCE`: Media resolution or information density is insufficient for a reliable conclusion.
  - `ANALYSIS_UNAVAILABLE`: One or both pipelines could not execute (e.g., network failure, unsupported codec, access restriction).
- **Final Verdict (`final_verdict`)**: `REAL`, `MANIPULATED`, `AI_GENERATED`, or `INCONCLUSIVE`.
- **Transparent Rationale (`reasons`)**: Human-readable, auditable bullet points justifying the verdict.

---

## 3. Modality Support & Extensibility

The EvidenceBundle contract natively supports **IMAGE**, **VIDEO**, and **AUDIO** modalities.

### How Future Analyzers Plug Into the Contract

Any specialized analyzer (Python service, WebAssembly module, microservice, or cloud agent) plugs into the contract by implementing a standard pipeline stage:

1. **Input**: Receives the normalized `media` descriptor:
   ```json
   {
     "media_id": "media-element-101",
     "modality": "VIDEO",
     "mime_type": "video/mp4",
     "width": 1920,
     "height": 1080,
     "duration_ms": 14200,
     "source": "https://example.com/stream.mp4",
     "access_status": "ACCESSIBLE"
   }
   ```
2. **Execution**:
   - **Video Analyzers**: Sample keyframes, compute optical flow continuity, detect frame flickering, and measure macroblock jitter across temporal GOP sequences.
   - **Audio Analyzers**: Compute Mel-spectrograms, harmonic-to-noise ratios (HNR), vocal tract resonances, and temporal waveform phase continuity.
   - **Image Analyzers**: Compute spatial noise residuals, 8x8 blockiness, and 2D FFT spectral decay.
3. **Output**: Populates its designated section (`forensic_ml.forensic_features.*`) without mutating other sections:
   - Partial features are fully supported: analyzers only populate the sub-objects relevant to their modality (`jpeg`, `noise`, `frequency`, `edges`, `texture`, `compression`, `metadata`).
4. **Validation**: The resulting bundle is validated against [`schemas/evidence-bundle.json`](../schemas/evidence-bundle.json).

---

## 4. Contract Schema & Fixtures

- **JSON Schema**: [`schemas/evidence-bundle.json`](../schemas/evidence-bundle.json)
- **Example Fixture (Test Data Only)**: [`integration/example-evidence-bundle.json`](example-evidence-bundle.json)
