"""
FORENSIGHT — Google Gemini Multimodal Forensic Analyzer
========================================================

Executes multimodal visual reasoning on image media using the official
Google Gemini Python SDK (google-genai).

Key Guarantees:
- Never hardcodes or prints API keys (reads GEMINI_API_KEY from environment).
- Model configurable via GEMINI_MODEL (defaults to gemini-2.0-flash).
- Produces structured output matching schemas/evidence-bundle.json under `gemini`.
- Comprehensive error handling: never crashes the caller pipeline on network/auth/parse failure.
- Returns standardized safe fallback with available=False and assessment=INCONCLUSIVE on error.
- Never fabricates confidence percentages or final verdicts.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, Optional, Union

from PIL import Image

try:
    from google import genai
    from google.genai import types
    _GENAI_AVAILABLE = True
except ImportError:
    genai = None  # type: ignore
    types = None  # type: ignore
    _GENAI_AVAILABLE = False

from gemini.prompt import FORENSIC_SYSTEM_INSTRUCTION, USER_FORENSIC_PROMPT
from gemini.schemas import (
    GeminiAssessment,
    GeminiForensicPayload,
    create_fallback_gemini_result,
    create_gemini_result,
)

# Default model if not specified in environment
DEFAULT_GEMINI_MODEL = "gemini-3.6-flash"


def _resolve_api_key() -> str:
    """
    Resolves GEMINI_API_KEY from environment, with Windows registry fallback
    for System/User environment variables that may not have propagated to the shell.
    """
    # If explicitly defined in os.environ (even if empty in tests), respect process environment
    if "GEMINI_API_KEY" in os.environ:
        return os.environ.get("GEMINI_API_KEY", "").strip()

    # Windows registry fallback only if not defined in process environment at all
    if os.name == "nt":
        try:
            import winreg
            # Check Machine environment
            try:
                with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment") as k:
                    val, _ = winreg.QueryValueEx(k, "GEMINI_API_KEY")
                    if val and str(val).strip():
                        return str(val).strip()
            except Exception:
                pass

            # Check User environment
            try:
                with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Environment") as k:
                    val, _ = winreg.QueryValueEx(k, "GEMINI_API_KEY")
                    if val and str(val).strip():
                        return str(val).strip()
            except Exception:
                pass
        except Exception:
            pass

    return ""


def _sanitize_error_message(error: Union[Exception, str]) -> str:
    """
    Sanitizes error messages to prevent inadvertent leakage of API keys,
    tokens, or internal network paths.
    """
    raw_msg = str(error)
    # Mask potential Google API key patterns (AIza...)
    sanitized = re.sub(r"AIza[0-9A-Za-z_\-]{20,}", "[REDACTED_API_KEY]", raw_msg)
    # Mask AQ-format tokens
    sanitized = re.sub(r"AQ\.[0-9A-Za-z_\-\.]{20,}", "[REDACTED_TOKEN]", sanitized)
    # Also mask whatever is in resolved key if present
    env_key = _resolve_api_key()
    if env_key and len(env_key) > 6:
        sanitized = sanitized.replace(env_key, "[REDACTED_API_KEY]")
    # Truncate overly long stack traces
    if len(sanitized) > 250:
        sanitized = sanitized[:247] + "..."
    return sanitized.strip()


def _parse_gemini_response_text(raw_text: str) -> Dict[str, Any]:
    """
    Parses response text into a dictionary, stripping markdown code fences if present.
    """
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        # Strip opening fence (``` or ```json)
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        # Strip closing fence
        cleaned = re.sub(r"\s*```$", "", cleaned)
        cleaned = cleaned.strip()

    return json.loads(cleaned)


def analyze_image_with_gemini(
    image_path: Union[str, Path],
    model_name: Optional[str] = None,
    client: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Analyzes an image using Google Gemini multimodal visual reasoning.

    Args:
        image_path: Path to the target image file.
        model_name: Optional model override (falls back to GEMINI_MODEL env or DEFAULT_GEMINI_MODEL).
        client: Optional pre-configured genai.Client instance (useful for dependency injection / testing).

    Returns:
        Structured dictionary matching schemas/evidence-bundle.json under `gemini`:
        {
            "available": bool,
            "model": str,
            "assessment": "REAL_LIKELY" | "MANIPULATION_LIKELY" | "AI_GENERATED_LIKELY" | "INCONCLUSIVE",
            "observations": list[str],
            "indicators": list[str],
            "limitations": list[str]
        }
    """
    # 1. Resolve model name
    effective_model = (
        model_name
        or os.environ.get("GEMINI_MODEL")
        or DEFAULT_GEMINI_MODEL
    ).strip()

    # 2. Check SDK installation
    if not _GENAI_AVAILABLE:
        return create_fallback_gemini_result(
            model=effective_model,
            reason="Google GenAI SDK (google-genai) is not installed in the Python environment."
        )

    # 3. Check API Key
    api_key = _resolve_api_key()
    if not api_key and client is None:
        return create_fallback_gemini_result(
            model=effective_model,
            reason="GEMINI_API_KEY environment variable is not set."
        )

    # 4. Check image file existence
    path = Path(image_path)
    if not path.is_file():
        return create_fallback_gemini_result(
            model=effective_model,
            reason=f"Target image file does not exist: {path.name}"
        )

    # 5. Load and validate image file
    try:
        with Image.open(path) as img:
            img.load()
            # Convert cleanly to RGB to ensure compatible image format for multimodal ingestion
            if img.mode == "P" and "transparency" in img.info:
                pil_image = img.convert("RGBA").convert("RGB")
            elif img.mode != "RGB":
                pil_image = img.convert("RGB")
            else:
                pil_image = img.copy()
    except Exception as exc:
        return create_fallback_gemini_result(
            model=effective_model,
            reason=f"Failed to read image file: {_sanitize_error_message(exc)}"
        )

    # 6. Initialize Gemini Client
    active_client = client
    if active_client is None:
        try:
            active_client = genai.Client(api_key=api_key)
        except Exception as exc:
            return create_fallback_gemini_result(
                model=effective_model,
                reason=f"Failed to initialize Gemini client: {_sanitize_error_message(exc)}"
            )

    # 7. Configure request & call Gemini API
    try:
        config = types.GenerateContentConfig(
            system_instruction=FORENSIC_SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=GeminiForensicPayload,
            temperature=0.1,
        )

        response = active_client.models.generate_content(
            model=effective_model,
            contents=[pil_image, USER_FORENSIC_PROMPT],
            config=config,
        )
    except Exception as exc:
        return create_fallback_gemini_result(
            model=effective_model,
            reason=f"Gemini API request failed: {_sanitize_error_message(exc)}"
        )

    # 8. Parse structured response
    try:
        parsed_payload: Optional[Dict[str, Any]] = None

        # Try SDK parsed attribute if available
        if hasattr(response, "parsed") and response.parsed is not None:
            if isinstance(response.parsed, GeminiForensicPayload):
                parsed_payload = response.parsed.model_dump()
            elif isinstance(response.parsed, dict):
                parsed_payload = response.parsed
            elif hasattr(response.parsed, "dict"):
                parsed_payload = response.parsed.dict()

        # Fallback to response.text if parsed is not directly populated
        if parsed_payload is None:
            raw_text = getattr(response, "text", "")
            if not raw_text:
                return create_fallback_gemini_result(
                    model=effective_model,
                    reason="Gemini returned an empty response."
                )
            parsed_payload = _parse_gemini_response_text(raw_text)

        if not isinstance(parsed_payload, dict):
            return create_fallback_gemini_result(
                model=effective_model,
                reason="Malformed Gemini response: output is not a JSON object."
            )

        assessment = parsed_payload.get("assessment", GeminiAssessment.INCONCLUSIVE.value)
        observations = parsed_payload.get("observations", [])
        indicators = parsed_payload.get("indicators", [])
        limitations = parsed_payload.get("limitations", [])

        # Validate list types
        if not isinstance(observations, list):
            observations = [str(observations)]
        if not isinstance(indicators, list):
            indicators = [str(indicators)]
        if not isinstance(limitations, list):
            limitations = [str(limitations)]

        return create_gemini_result(
            available=True,
            model=effective_model,
            assessment=assessment,
            observations=observations,
            indicators=indicators,
            limitations=limitations,
        )

    except Exception as exc:
        return create_fallback_gemini_result(
            model=effective_model,
            reason=f"Failed to parse Gemini response payload: {_sanitize_error_message(exc)}"
        )


if __name__ == "__main__":
    import sys

    target = sys.argv[1] if len(sys.argv) > 1 else "src/assets/hero.png"
    result = analyze_image_with_gemini(target)
    print(json.dumps(result, indent=2))
