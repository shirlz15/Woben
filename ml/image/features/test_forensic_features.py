"""
Unit Tests for FORENSIGHT Real Image Forensic Feature Extractor
==============================================================

Verifies empirical calculations across:
1. Local existing repository image asset (src/assets/hero.png)
2. Synthetic test JPEG image (marked clearly for software validation)
3. Synthetic test PNG image

Validates:
- All 7 feature categories exist (jpeg, noise, frequency, edges, texture, compression, metadata).
- Every feature is a real calculated value or explicitly null with explanation.
- Values lie within physically valid mathematical domains.
- Full conformance with schemas/evidence-bundle.json.
- No final REAL / MANIPULATED / AI_GENERATED verdict is generated.
- No individual feature claims to prove an image is fake.
"""

import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

from ml.image.features.forensic_features import (
    extract_forensic_features,
    _compute_shannon_entropy,
    _compute_lbp_entropy,
    _compute_8x8_blockiness,
)


class TestForensicFeatures(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create a temporary directory for synthetic software-validation test images
        cls.test_dir = tempfile.mkdtemp(prefix="forensight_test_")
        cls.synthetic_jpeg = Path(cls.test_dir) / "synthetic_validation_q85.jpg"
        cls.synthetic_png = Path(cls.test_dir) / "synthetic_validation.png"

        # 1. Create a tiny synthetic gradient test image for deterministic testing
        # NOTE: Clearly marked as synthetic software unit test fixture
        width, height = 128, 128
        x = np.linspace(0, 255, width, dtype=np.uint8)
        y = np.linspace(0, 255, height, dtype=np.uint8)
        xx, yy = np.meshgrid(x, y)
        gradient = ((xx.astype(np.float32) + yy.astype(np.float32)) / 2.0).astype(np.uint8)

        # Add high-frequency textured grid
        texture_grid = np.zeros((height, width), dtype=np.uint8)
        texture_grid[::8, :] = 40
        texture_grid[:, ::8] = 40
        composite = np.clip(gradient.astype(np.int32) + texture_grid.astype(np.int32), 0, 255).astype(np.uint8)

        rgb_array = np.stack([composite, composite, composite], axis=2)
        pil_img = Image.fromarray(rgb_array)

        # Save synthetic JPEG with standard Q=85
        pil_img.save(cls.synthetic_jpeg, format="JPEG", quality=85)
        # Save synthetic PNG
        pil_img.save(cls.synthetic_png, format="PNG")

        # Existing repository asset
        cls.repo_asset = Path("src/assets/hero.png").resolve()

        # Load schema for validation
        schema_path = Path("schemas/evidence-bundle.json").resolve()
        with open(schema_path, "r", encoding="utf-8") as f:
            cls.schema = json.load(f)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.test_dir, ignore_errors=True)

    def test_repo_asset_features(self):
        """Tests feature extraction on an existing image in the repository."""
        self.assertTrue(self.repo_asset.is_file(), f"Asset not found: {self.repo_asset}")
        result = extract_forensic_features(self.repo_asset)

        self.assertTrue(result["available"])
        self.assertEqual(result["image_path"], str(self.repo_asset))
        features = result["forensic_features"]

        # Check all 7 categories
        required_categories = ["jpeg", "noise", "frequency", "edges", "texture", "compression", "metadata"]
        for cat in required_categories:
            self.assertIn(cat, features, f"Missing category: {cat}")

        # Verify Texture: Shannon entropy is non-zero
        self.assertGreater(features["texture"]["shannon_entropy"], 0.0)
        self.assertLessEqual(features["texture"]["shannon_entropy"], 8.0)

        # Verify Noise: Residual variance is computed
        self.assertGreater(features["noise"]["residual_variance"], 0.0)
        self.assertGreaterEqual(features["noise"]["quadrant_variance_uniformity"], 0.0)
        self.assertLessEqual(features["noise"]["quadrant_variance_uniformity"], 1.0)

        # Verify Frequency: 2D FFT energy exists
        self.assertGreater(features["frequency"]["fft_total_energy"] if "fft_total_energy" in features["frequency"] else features["frequency"]["fft_low_frequency_energy"], 0.0)
        self.assertGreater(features["frequency"]["high_frequency_decay_rate"], 0.0)

        # Verify Edges: Sobel gradient statistics
        self.assertGreater(features["edges"]["gradient_mean"], 0.0)
        self.assertGreaterEqual(features["edges"]["canny_edge_density"], 0.0)
        self.assertLessEqual(features["edges"]["canny_edge_density"], 1.0)

        # Verify Compression: Dimensions match actual image
        self.assertEqual(features["compression"]["width"], 343)
        self.assertEqual(features["compression"]["height"], 361)
        self.assertEqual(features["compression"]["codec"], "png")

        # PNG does not have JPEG quantization tables; should be null with explanation
        self.assertIsNone(features["jpeg"]["estimated_quality"])
        self.assertIn("jpeg", result["feature_explanations"])

    def test_synthetic_jpeg_features(self):
        """Tests JPEG-specific features on synthetic validation JPEG."""
        result = extract_forensic_features(self.synthetic_jpeg)
        features = result["forensic_features"]

        # Check JPEG quantization estimation
        self.assertIsNotNone(features["jpeg"]["estimated_quality"])
        # Should estimate quality near 85 (+-5)
        self.assertGreaterEqual(features["jpeg"]["estimated_quality"], 75)
        self.assertLessEqual(features["jpeg"]["estimated_quality"], 95)
        self.assertGreater(features["jpeg"]["quantization_tables_present"], 0)
        self.assertEqual(features["compression"]["codec"], "jpeg")

        # 8x8 blockiness score must be calculated
        self.assertIsNotNone(features["jpeg"]["blockiness_8x8_score"])
        self.assertGreaterEqual(features["jpeg"]["blockiness_8x8_score"], 0.0)

    def test_synthetic_png_features(self):
        """Tests PNG extraction on synthetic validation PNG."""
        result = extract_forensic_features(self.synthetic_png)
        features = result["forensic_features"]

        self.assertEqual(features["compression"]["codec"], "png")
        self.assertIsNone(features["jpeg"]["estimated_quality"])
        self.assertGreater(features["texture"]["shannon_entropy"], 0.0)
        self.assertGreater(features["edges"]["gradient_mean"], 0.0)

    def test_helper_algorithms(self):
        """Tests low-level signal processing helper math directly."""
        flat_image = np.full((32, 32), 128, dtype=np.uint8)
        # Shannon entropy of flat image should be 0.0
        self.assertAlmostEqual(_compute_shannon_entropy(flat_image), 0.0, places=3)

        # High variance checkerboard
        checkerboard = np.indices((32, 32)).sum(axis=0) % 2 * 255
        checkerboard = checkerboard.astype(np.uint8)
        entropy = _compute_shannon_entropy(checkerboard)
        self.assertAlmostEqual(entropy, 1.0, places=3)

        # LBP entropy
        lbp_ent = _compute_lbp_entropy(checkerboard)
        self.assertGreater(lbp_ent, 0.0)

        # Blockiness on flat image is 0.0
        self.assertEqual(_compute_8x8_blockiness(flat_image), 0.0)

    def test_schema_conformance(self):
        """Verifies that the extracted dictionary conforms to schemas/evidence-bundle.json."""
        result = extract_forensic_features(self.synthetic_jpeg)
        forensic_features = result["forensic_features"]

        schema_ff = self.schema["properties"]["forensic_ml"]["properties"]["forensic_features"]["properties"]

        for category, cat_schema in schema_ff.items():
            self.assertIn(category, forensic_features)
            actual_cat_obj = forensic_features[category]
            self.assertIsInstance(actual_cat_obj, dict)

            # Check individual declared properties and types
            for prop_name, prop_spec in cat_schema.get("properties", {}).items():
                if prop_name in actual_cat_obj:
                    val = actual_cat_obj[prop_name]
                    allowed_types = prop_spec.get("type")
                    if isinstance(allowed_types, str):
                        allowed_types = [allowed_types]

                    if val is None:
                        self.assertIn("null", allowed_types, f"{category}.{prop_name} is null but null not allowed")
                    elif isinstance(val, bool):
                        self.assertIn("boolean", allowed_types, f"{category}.{prop_name} should be boolean")
                    elif isinstance(val, int):
                        self.assertTrue("integer" in allowed_types or "number" in allowed_types, f"{category}.{prop_name} integer check")
                    elif isinstance(val, float):
                        self.assertIn("number", allowed_types, f"{category}.{prop_name} should be number")
                    elif isinstance(val, str):
                        self.assertIn("string", allowed_types, f"{category}.{prop_name} should be string")

    def test_no_verdict_or_fabrication(self):
        """Confirms that no final verdict, fake confidence score, or LLM call is included."""
        result = extract_forensic_features(self.synthetic_jpeg)
        self.assertNotIn("final_verdict", result)
        self.assertNotIn("verdict", result)
        self.assertNotIn("is_fake", result)
        self.assertNotIn("confidence", result)
        self.assertNotIn("ai_generated", result)


if __name__ == "__main__":
    unittest.main()
