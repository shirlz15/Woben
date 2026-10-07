# FORENSIGHT — Gemini Multimodal Analysis Module

This module integrates Google Gemini's multimodal foundation models as an independent visual and contextual reasoning evidence source for FORENSIGHT.

It provides high-level semantic reasoning, physical plausibility checking, and visual anomaly interpretation without making unilateral final verdicts, fabricating numerical confidence scores, or replacing deterministic signal-level forensics.

---

## 🏛️ Architecture Role: Multi-Evidence Independence

In digital forensics, relying on a single detection mechanism leads to brittle false positives and adversarial vulnerabilities:

```
                          MEDIA ACQUIRED FROM DOM
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
      FORENSIC ML PIPELINE                    GEMINI MULTIMODAL ANALYZER
   (Empirical Signal Analysis)              (Semantic & Physical Reasoning)
                 │                                       │
                 │  • 2D FFT spectral decay              │  • Physical lighting & shadows
                 │  • Noise residuals & PRNU             │  • Euclidean perspective logic
                 │  • Quantization tables & DCT          │  • Anatomical biometrics & limbs
                 │  • Gradient edges & entropy           │  • Text & glyph coherence
                 │                                       │
                 └───────────────────┬───────────────────┘
                                     ▼
                              DECISION FUSION
                      (Agreement, Conflict & Status)
                                     │
                                     ▼
                            EVIDENCE BUNDLE
```

### Critical Separation of Concerns
1. **Gemini is NOT the sole forensic detector**: Gemini observes semantic incongruities, shadow vector conflicts, and visual generation signatures. It cannot calculate mathematical PRNU correlations or JPEG quantization matrices.
2. **Evidence Source, Not Final Arbiter**: Gemini outputs an independent `assessment` (`REAL_LIKELY`, `MANIPULATION_LIKELY`, `AI_GENERATED_LIKELY`, `INCONCLUSIVE`). The final decision is synthesized downstream in the **Decision Fusion** layer.
3. **No Fabricated Confidence Percentages**: Gemini outputs qualitative, verifiable observations and indicators rather than pseudo-statistical confidence numbers (e.g. *"91% fake"*).

---

## 📦 Installation & Dependencies

The module uses the official **Google GenAI Python SDK** (`google-genai`):

```bash
pip install google-genai pydantic pillow
```

Verify the installation:
```bash
python -c "import google.genai; print('google-genai installed successfully!')"
```

---

## 🔐 Configuration & Environment Variables

### Required Environment Variable
- **`GEMINI_API_KEY`**: Your Google Gemini API key.

> [!CAUTION]
> **Security Warning**:
> - NEVER hardcode the API key in source code.
> - NEVER commit `.env` or files containing keys to Git.
> - The analyzer sanitizes error logs, but keys must always be managed through environment variables or secure secret managers.

### Optional Environment Variable
- **`GEMINI_MODEL`**: The Gemini model to invoke. Defaults to **`gemini-3.6-flash`**.
  - Recommended options: `gemini-3.6-flash`, `gemini-1.5-pro`, `gemini-1.5-flash`.

---

## 💻 Environment Setup Examples

### Windows PowerShell
```powershell
# Set API key for the current session
$env:GEMINI_API_KEY="your-actual-gemini-api-key-here"

# (Optional) Override model
$env:GEMINI_MODEL="gemini-2.0-flash"
```

### Windows Command Prompt (CMD)
```cmd
:: Set API key for the current session
set GEMINI_API_KEY=your-actual-gemini-api-key-here

:: (Optional) Override model
set GEMINI_MODEL=gemini-2.0-flash
```

### Linux / macOS
```bash
export GEMINI_API_KEY="your-actual-gemini-api-key-here"
export GEMINI_MODEL="gemini-2.0-flash"
```

---

## 🚀 Usage & Invocation

### Python API
```python
from pathlib import Path
from gemini.gemini_analyzer import analyze_image_with_gemini

# Analyze an image file
result = analyze_image_with_gemini("path/to/image.jpg")

print("Available:", result["available"])
print("Model:", result["model"])
print("Assessment:", result["assessment"])
print("Observations:", result["observations"])
print("Indicators:", result["indicators"])
print("Limitations:", result["limitations"])
```

### CLI Execution
```bash
python -m gemini.gemini_analyzer path/to/image.jpg
```

---

## 📋 Expected Output Structure (EvidenceBundle Contract)

The return value maps directly into the `gemini` property of [`schemas/evidence-bundle.json`](../schemas/evidence-bundle.json):

```json
{
  "available": true,
  "model": "gemini-3.6-flash",
  "assessment": "AI_GENERATED_LIKELY",
  "observations": [
    "Specular reflection on left pupil indicates primary light at 45 degrees, whereas right pupil reflection indicates diffuse overhead lighting.",
    "Architectural pillars in background diverge from the natural ground-plane vanishing point."
  ],
  "indicators": [
    "Anatomical anomaly: Left hand displays distorted knuckle articulation with 6 distinct finger joints.",
    "Uncharacteristic hyper-smooth skin texture lacking organic pore structure."
  ],
  "limitations": [
    "Source image is downscaled from original capture resolution.",
    "No contextual camera provenance metadata available for cross-verification."
  ]
}
```

### Assessment Taxonomy
- **`REAL_LIKELY`**: Lighting, perspective, geometry, and subject biometrics are physically coherent without observable synthesis markers.
- **`MANIPULATION_LIKELY`**: Observable evidence indicates localized tampering, splicing, seam carving, inpainting, or composite editing.
- **`AI_GENERATED_LIKELY`**: Observable visual evidence indicates full generative model synthesis (diffusion, GAN).
- **`INCONCLUSIVE`**: Insufficient resolution, heavy compression artifacts, artistic abstraction, or ambiguous evidence.

---

## 🛡️ Failure & Fallback Behavior

If any of the following occur:
- `GEMINI_API_KEY` is missing or invalid
- Network connectivity fails or times out
- Google Gemini API returns a rate-limit / quota error
- The image file cannot be read or decoded
- Response payload fails validation

The analyzer **never crashes the caller pipeline**. Instead, it gracefully returns a standardized fallback dictionary conforming to the EvidenceBundle schema:

```json
{
  "available": false,
  "model": "gemini-3.6-flash",
  "assessment": "INCONCLUSIVE",
  "observations": [],
  "indicators": [],
  "limitations": [
    "Gemini analysis unavailable: GEMINI_API_KEY environment variable is not set."
  ]
}
```

Error messages are automatically sanitized to prevent accidental leakage of API keys or sensitive host paths.

---

## 🧪 Testing

Run the automated test suite:
```bash
python -m unittest -v gemini/test_gemini_analyzer.py
```

*Note: All standard unit tests execute in offline mode using mocks. When `GEMINI_API_KEY` is present in the environment, the optional live integration test automatically activates.*
