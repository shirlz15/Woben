"""
Unit Tests for FORENSIGHT Gemini Multimodal Analyzer
=====================================================

Validates:
1. Missing GEMINI_API_KEY returns safe fallback (available=False, assessment=INCONCLUSIVE).
2. Invalid/missing image path is handled gracefully without crashing.
3. Malformed Gemini API response is caught and reported safely.
4. Valid structured responses are parsed accurately into EvidenceBundle format.
5. Exact EvidenceBundle schema conformance (schemas/evidence-bundle.json).
6. No fabricated confidence scores, percentages, or final verdicts are produced.
7. Secrets/API keys are sanitized from error messages.

NOTE: All unit tests execute entirely offline via mocks and do NOT require an API key.
"""

import json
import os
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from gemini.gemini_analyzer import (
    DEFAULT_GEMINI_MODEL,
    analyze_image_with_gemini,
    _sanitize_error_message,
)
from gemini.schemas import (
    GeminiAssessment,
    create_fallback_gemini_result,
    create_gemini_result,
)


class TestGeminiAnalyzer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Load EvidenceBundle schema to verify strict compatibility
        schema_path = Path("schemas/evidence-bundle.json").resolve()
        with open(schema_path, "r", encoding="utf-8") as f:
            cls.schema = json.load(f)
        cls.gemini_schema = cls.schema["properties"]["gemini"]
        cls.test_image_path = Path("src/assets/hero.png").resolve()

    def test_missing_api_key_returns_safe_fallback(self):
        """When GEMINI_API_KEY is not set, analyzer must return safe fallback without crashing."""
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}, clear=True):
            result = analyze_image_with_gemini(self.test_image_path)

            self.assertFalse(result["available"])
            self.assertEqual(result["assessment"], GeminiAssessment.INCONCLUSIVE.value)
            self.assertEqual(result["observations"], [])
            self.assertEqual(result["indicators"], [])
            self.assertTrue(len(result["limitations"]) > 0)
            self.assertIn("GEMINI_API_KEY environment variable is not set", result["limitations"][0])
            self.assertIn("model", result)

    def test_invalid_image_path_handling(self):
        """Non-existent image paths must return safe fallback without crashing."""
        with patch.dict(os.environ, {"GEMINI_API_KEY": "dummy_test_key"}):
            missing_path = "non_existent_image_for_testing_123.jpg"
            result = analyze_image_with_gemini(missing_path)

            self.assertFalse(result["available"])
            self.assertEqual(result["assessment"], GeminiAssessment.INCONCLUSIVE.value)
            self.assertTrue(any("does not exist" in lim for lim in result["limitations"]))

    def test_malformed_response_handling(self):
        """Malformed or non-JSON response from Gemini must be handled gracefully."""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.parsed = None
        mock_response.text = "This is plain conversational text without valid JSON <<>>"
        mock_client.models.generate_content.return_value = mock_response

        with patch.dict(os.environ, {"GEMINI_API_KEY": "dummy_test_key"}):
            result = analyze_image_with_gemini(
                self.test_image_path,
                client=mock_client
            )

            self.assertFalse(result["available"])
            self.assertEqual(result["assessment"], GeminiAssessment.INCONCLUSIVE.value)
            self.assertTrue(any("Failed to parse" in lim or "Malformed" in lim for lim in result["limitations"]))

    def test_valid_structured_response_parsing(self):
        """Valid structured JSON response must be parsed correctly into EvidenceBundle format."""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.parsed = None
        mock_response.text = json.dumps({
            "assessment": "AI_GENERATED_LIKELY",
            "observations": [
                "Unnatural symmetry across facial features",
                "Non-Euclidean background perspective"
            ],
            "indicators": [
                "Anatomical hand distortion: 6 finger knuckles visible",
                "Characteristic diffusion texture smoothing"
            ],
            "limitations": [
                "Image downscaled prior to inspection"
            ]
        })
        mock_client.models.generate_content.return_value = mock_response

        with patch.dict(os.environ, {"GEMINI_API_KEY": "dummy_test_key"}):
            result = analyze_image_with_gemini(
                self.test_image_path,
                model_name="gemini-3.6-flash",
                client=mock_client
            )

            self.assertTrue(result["available"])
            self.assertEqual(result["model"], "gemini-3.6-flash")
            self.assertEqual(result["assessment"], "AI_GENERATED_LIKELY")
            self.assertEqual(len(result["observations"]), 2)
            self.assertEqual(len(result["indicators"]), 2)
            self.assertEqual(len(result["limitations"]), 1)
            self.assertIn("6 finger knuckles", result["indicators"][0])

    def test_markdown_code_block_stripping(self):
        """Structured JSON wrapped in markdown code blocks must be unwrapped cleanly."""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.parsed = None
        mock_response.text = "```json\n" + json.dumps({
            "assessment": "REAL_LIKELY",
            "observations": ["Consistent shadow vectors matching sunlight"],
            "indicators": ["Normal camera sensor noise profile"],
            "limitations": ["Metadata stripped by web platform"]
        }) + "\n```"
        mock_client.models.generate_content.return_value = mock_response

        with patch.dict(os.environ, {"GEMINI_API_KEY": "dummy_test_key"}):
            result = analyze_image_with_gemini(
                self.test_image_path,
                client=mock_client
            )

            self.assertTrue(result["available"])
            self.assertEqual(result["assessment"], "REAL_LIKELY")
            self.assertEqual(result["observations"][0], "Consistent shadow vectors matching sunlight")

    def test_evidence_bundle_schema_compatibility(self):
        """Verifies strict schema conformance against schemas/evidence-bundle.json."""
        # Both success and fallback results must conform
        sample_results = [
            create_gemini_result(
                available=True,
                model="gemini-3.6-flash",
                assessment="MANIPULATION_LIKELY",
                observations=["Observation 1"],
                indicators=["Indicator 1"],
                limitations=["Limitation 1"]
            ),
            create_fallback_gemini_result(
                model=DEFAULT_GEMINI_MODEL,
                reason="Simulated failure"
            )
        ]

        required_fields = set(self.gemini_schema["required"])
        allowed_fields = set(self.gemini_schema["properties"].keys())
        allowed_assessments = set(self.gemini_schema["properties"]["assessment"]["enum"])

        for res in sample_results:
            # Check all required fields present
            self.assertTrue(required_fields.issubset(set(res.keys())))
            # Check no additional properties (schema specifies additionalProperties: false)
            self.assertEqual(set(res.keys()), allowed_fields)
            # Check types
            self.assertIsInstance(res["available"], bool)
            self.assertIsInstance(res["model"], str)
            self.assertIsInstance(res["assessment"], str)
            self.assertIn(res["assessment"], allowed_assessments)
            self.assertIsInstance(res["observations"], list)
            self.assertIsInstance(res["indicators"], list)
            self.assertIsInstance(res["limitations"], list)

    def test_no_fabricated_confidence_or_verdict(self):
        """Confirms that no ungrounded confidence percentages or final verdicts are produced."""
        result = create_fallback_gemini_result(DEFAULT_GEMINI_MODEL, "Network timeout")
        self.assertNotIn("confidence", result)
        self.assertNotIn("score", result)
        self.assertNotIn("final_verdict", result)
        self.assertNotIn("verdict", result)
        self.assertNotIn("percentage", result)

    def test_secret_sanitization_in_errors(self):
        """Verifies that API keys matching Google key format are redacted in error messages."""
        fake_secret_key = "AIzaSyDummySecretKey1234567890123456"
        error_with_key = f"API request failed with key {fake_secret_key}: Quota exceeded"
        sanitized = _sanitize_error_message(error_with_key)

        self.assertNotIn(fake_secret_key, sanitized)
        self.assertIn("[REDACTED_API_KEY]", sanitized)

    @unittest.skipUnless(
        os.environ.get("GEMINI_API_KEY"),
        "Live integration test skipped: GEMINI_API_KEY is not set in environment"
    )
    def test_live_api_call_when_key_provided(self):
        """Optional manual integration test executed only when GEMINI_API_KEY is actively provided."""
        result = analyze_image_with_gemini(self.test_image_path)
        self.assertTrue(result["available"])
        self.assertIn(result["assessment"], [
            GeminiAssessment.REAL_LIKELY.value,
            GeminiAssessment.MANIPULATION_LIKELY.value,
            GeminiAssessment.AI_GENERATED_LIKELY.value,
            GeminiAssessment.INCONCLUSIVE.value,
        ])
        self.assertIsInstance(result["observations"], list)
        self.assertIsInstance(result["indicators"], list)
        self.assertIsInstance(result["limitations"], list)


if __name__ == "__main__":
    unittest.main()
