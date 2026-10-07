# FORENSIGHT — Real Image Forensic Feature Extractor

This module implements empirical, mathematical feature extraction for digital image media forensics. It operates directly on raw pixel arrays, spectral frequency transforms, and container bitstreams without calling external LLMs, fabricating black-box confidence scores, or relying on heuristic assumptions.

The output strictly conforms to the `forensic_ml.forensic_features` specification in [`schemas/evidence-bundle.json`](../../../schemas/evidence-bundle.json).

---

## 🔬 Forensic Signal Processing Categories

| Category | Mathematical / Empirical Operation | Extracted Metrics |
| :--- | :--- | :--- |
| **JPEG / Quantization** | • Extraction of DQT quantization tables (table 0 luminance)<br>• Inverse quantization scaling factor estimation ($Q = 200 - S/2$ or $Q = 5000/S$)<br>• 8×8 grid boundary gradient discontinuity ratio | `quantization_table_match`, `estimated_quality`, `quantization_tables_present`, `blockiness_8x8_score`, `double_compression_detected` |
| **Noise Residuals** | • 3×3 median filter spatial residual $R = Y - \text{median}(Y)$<br>• Residual variance $\sigma^2_R$ & standard deviation<br>• Signal-to-noise ratio: $\text{SNR} = 10 \log_{10}(\sigma^2_{\text{signal}} / \sigma^2_R)$<br>• Spatial quadrant variance uniformity ratio: $\min(\sigma^2_{Q_i}) / \max(\sigma^2_{Q_i})$ | `residual_variance`, `residual_std`, `residual_mean`, `noise_snr_db`, `quadrant_variance_uniformity`, `prnu_correlation` |
| **Frequency (2D FFT)** | • Centered 2D Fast Fourier Transform $F(u, v)$ & power spectrum $|F|^2$<br>• Low vs. high spatial frequency radial partition ($r \le 0.25 r_{\max}$ vs. $r > 0.50 r_{\max}$)<br>• Log-log radial azimuthal decay slope: $P(r) \propto r^{-\alpha}$<br>• High-frequency periodic grid peak energy ratio (GAN upsampling check) | `fft_low_frequency_energy`, `fft_high_frequency_energy`, `spectral_ratio`, `high_frequency_decay_rate`, `grid_peak_energy`, `spectral_rolloff_hz` |
| **Edges & Gradients** | • $3\times3$ Sobel gradient vector magnitude: $\sqrt{G_x^2 + G_y^2}$<br>• Canny edge pixel density (hysteresis thresholds 50 / 150)<br>• Boundary perimeter vs. interior discontinuity index | `gradient_mean`, `gradient_std`, `sobel_gradient_max`, `canny_edge_density`, `boundary_discontinuity_index` |
| **Texture & Entropy** | • Grayscale intensity histogram Shannon entropy ($0 \le H \le 8$ bits)<br>• 8-neighbor Local Binary Pattern (LBP) code matrix entropy<br>• $5\times5$ local variance sliding window mean<br>• Gray-Level Co-occurrence Matrix (GLCM) horizontal contrast | `shannon_entropy`, `local_binary_pattern_entropy`, `local_variance_mean`, `glcm_contrast` |
| **Container & Compression** | • Native width, height, aspect ratio, color mode<br>• On-disk file size in bytes<br>• Codec container string | `codec`, `file_size_bytes`, `width`, `height`, `aspect_ratio`, `color_mode`, `bitrate_kbps`, `macroblock_jitter` |
| **Metadata & Provenance** | • EXIF tag header inspection (`Make`, `Model`, `Software`)<br>• Tag presence enumeration<br>• C2PA / JUMBF cryptographic container marker detection | `has_exif`, `camera_make`, `camera_model`, `software_signature`, `metadata_keys_present`, `c2pa_manifest_present`, `c2pa_signature_valid` |

---

## 🛡️ Forensic Principles Enforced

1. **Deterministic & Measurable**: Every numerical value is computed through deterministic math. No random seeds, no pseudo-metrics.
2. **Explicit Null Handling**: When a feature cannot be computed (e.g., JPEG quantization tables on a PNG file, or temporal macroblock jitter on a static image), the field returns `null` (`None`) with an explicit reason documented in `feature_explanations`.
3. **No Fabricated Verdicts**: This module does **not** generate final `REAL`, `MANIPULATED`, or `AI_GENERATED` classifications. Classification and fusion are separate stages that combine multiple calibrated models with multimodal semantic reasoning.
4. **No Single-Signal Accusations**: Forensic research shows that metadata absence, high compression, or low entropy can occur naturally (e.g. social media stripping, minimalist art). Individual features represent objective measurements, not verdicts.

---

## 🚀 Usage

```python
from pathlib import Path
from ml.image.features.forensic_features import extract_forensic_features

# Extract features from a local image path
results = extract_forensic_features("path/to/image.jpg")

# Access structured features conforming to schemas/evidence-bundle.json
features = results["forensic_features"]
print("Estimated JPEG Quality:", features["jpeg"]["estimated_quality"])
print("Residual Noise Variance:", features["noise"]["residual_variance"])
print("Shannon Entropy:", features["texture"]["shannon_entropy"])
print("2D FFT Spectral Ratio:", features["frequency"]["spectral_ratio"])

# Access explanation of unavailable features or constraints
print("Explanations:", results["feature_explanations"])
```

### CLI Execution
```bash
python ml/image/features/forensic_features.py path/to/image.jpg
```

---

## 🧪 Testing

Run the automated unit tests:
```bash
python -m unittest ml/image/features/test_forensic_features.py
```
