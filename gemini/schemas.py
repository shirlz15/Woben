"""
FORENSIGHT — Gemini Multimodal Analysis Schemas & Output Contracts
==================================================================

Defines data models and validation helpers strictly conforming to the
gemini section of schemas/evidence-bundle.json:

gemini:
  available: bool
  model: str
  assessment: "REAL_LIKELY" | "MANIPULATION_LIKELY" | "AI_GENERATED_LIKELY" | "INCONCLUSIVE"
  observations: list[str]
  indicators: list[str]
  limitations: list[str]
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional, Set
from pydantic import BaseModel, Field


class GeminiAssessment(str, Enum):
    """Allowed high-level contextual assessment values."""
    REAL_LIKELY = "REAL_LIKELY"
    MANIPULATION_LIKELY = "MANIPULATION_LIKELY"
    AI_GENERATED_LIKELY = "AI_GENERATED_LIKELY"
    INCONCLUSIVE = "INCONCLUSIVE"


VALID_ASSESSMENTS: Set[str] = {
    GeminiAssessment.REAL_LIKELY.value,
    GeminiAssessment.MANIPULATION_LIKELY.value,
    GeminiAssessment.AI_GENERATED_LIKELY.value,
    GeminiAssessment.INCONCLUSIVE.value,
}


class GeminiForensicPayload(BaseModel):
    """
    Structured model for Gemini structured JSON generation.
    Strictly restricted to the fields returned by the model.
    """
    assessment: GeminiAssessment = Field(
        ...,
        description="High-level contextual assessment: REAL_LIKELY, MANIPULATION_LIKELY, AI_GENERATED_LIKELY, or INCONCLUSIVE."
    )
    observations: List[str] = Field(
        default_factory=list,
        description="Objective semantic, physical, lighting, or contextual observations noted during visual inspection."
    )
    indicators: List[str] = Field(
        default_factory=list,
        description="Specific observable anomalies or synthesis signatures that justify the assessment."
    )
    limitations: List[str] = Field(
        default_factory=list,
        description="Observational constraints, ambiguity, lack of context, or low-resolution limitations."
    )


def create_gemini_result(
    available: bool,
    model: str,
    assessment: str,
    observations: List[str],
    indicators: List[str],
    limitations: List[str],
) -> Dict[str, Any]:
    """
    Creates and validates a dictionary matching schemas/evidence-bundle.json under `gemini`.

    Enforces:
    - Exactly 6 allowed keys (additionalProperties: false in schema).
    - Valid assessment enum string.
    - String items in list fields.
    - No fabricated confidence scores.
    """
    normalized_assessment = str(assessment).strip().upper()
    if normalized_assessment not in VALID_ASSESSMENTS:
        normalized_assessment = GeminiAssessment.INCONCLUSIVE.value

    return {
        "available": bool(available),
        "model": str(model).strip(),
        "assessment": normalized_assessment,
        "observations": [str(item).strip() for item in observations if str(item).strip()],
        "indicators": [str(item).strip() for item in indicators if str(item).strip()],
        "limitations": [str(item).strip() for item in limitations if str(item).strip()],
    }


def create_fallback_gemini_result(
    model: str,
    reason: str,
) -> Dict[str, Any]:
    """
    Creates a standardized safe fallback result when Gemini is unavailable,
    unconfigured, or fails to execute. Never crashes the pipeline.
    """
    # Sanitize reason string to prevent secret leakage
    sanitized_reason = str(reason).strip()
    return {
        "available": False,
        "model": str(model).strip(),
        "assessment": GeminiAssessment.INCONCLUSIVE.value,
        "observations": [],
        "indicators": [],
        "limitations": [f"Gemini analysis unavailable: {sanitized_reason}"],
    }
