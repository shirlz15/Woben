"""
FORENSIGHT — Real Image Forensic Feature Extractor
===================================================

Extracts empirical, measurable forensic signal features directly from image files
without relying on black-box heuristics, random scores, LLMs, or synthetic labels.

Categories extracted (matching schemas/evidence-bundle.json):
1. JPEG / Quantization: Quantization table analysis, quality estimation, 8x8 blockiness.
2. Noise: Median-filter residual statistics, spatial variance, quadrant uniformity.
3. Frequency: 2D FFT spectral energy distributions, spectral ratio, azimuthal decay.
4. Edges: Sobel gradient statistics, Canny edge density, boundary coherence.
5. Texture: Shannon entropy, Local Binary Pattern (LBP) entropy, local variance.
6. Compression: Container dimensions, file size, codec format.
7. Metadata: EXIF tag presence, camera info, C2PA Content Credentials inspection.

IMPORTANT FORENSIC PRINCIPLES:
- Every value returned is a directly computed mathematical measurement.
- If a feature cannot be computed (e.g. JPEG tables on a PNG), null is returned with an explicit reason.
- No individual feature proves manipulation or authenticity on its own.
- No final REAL / MANIPULATED / AI_GENERATED verdict is generated here.
"""

from __future__ import annotations

import math
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
from PIL import Image, ExifTags
import cv2

# Standard Independent JPEG Group (IJG) standard luminance quantization table
# Used as a baseline reference for estimating JPEG quality factors.
IJG_STANDARD_LUMINANCE_Q50 = np.array([
    [16, 11, 10, 16, 24, 40, 51, 61],
    [12, 12, 14, 19, 26, 58, 60, 55],
    [14, 13, 16, 24, 40, 57, 69, 56],
    [14, 17, 22, 29, 51, 87, 80, 62],
    [18, 22, 37, 56, 68, 109, 103, 77],
    [24, 35, 55, 64, 81, 104, 113, 92],
    [49, 64, 78, 87, 103, 121, 120, 101],
    [72, 92, 95, 98, 112, 100, 103, 99]
], dtype=np.float64)


def _compute_shannon_entropy(gray_array: np.ndarray) -> float:
    """Computes Shannon entropy (in bits) from grayscale intensity histogram."""
    hist, _ = np.histogram(gray_array.ravel(), bins=256, range=(0, 256))
    total_pixels = gray_array.size
    if total_pixels == 0:
        return 0.0
    probabilities = hist / float(total_pixels)
    non_zero_probs = probabilities[probabilities > 0]
    entropy = -float(np.sum(non_zero_probs * np.log2(non_zero_probs)))
    return round(entropy, 4)


def _compute_lbp_entropy(gray_array: np.ndarray) -> float:
    """
    Computes Shannon entropy of an 8-neighbor Local Binary Pattern (LBP) code matrix.
    LBP measures micro-texture spatial consistency across pixel neighborhoods.
    """
    h, w = gray_array.shape
    if h < 3 or w < 3:
        return 0.0

    # Vectorized 8-neighbor comparison against center pixel
    center = gray_array[1:-1, 1:-1].astype(np.int32)
    lbp = np.zeros(center.shape, dtype=np.uint8)

    shifts = [
        (-1, -1, 0),  # top-left
        (-1,  0, 1),  # top
        (-1,  1, 2),  # top-right
        ( 0,  1, 3),  # right
        ( 1,  1, 4),  # bottom-right
        ( 1,  0, 5),  # bottom
        ( 1, -1, 6),  # bottom-left
        ( 0, -1, 7)   # left
    ]

    for dy, dx, bit in shifts:
        neighbor = gray_array[1 + dy : h - 1 + dy, 1 + dx : w - 1 + dx].astype(np.int32)
        lbp |= ((neighbor >= center).astype(np.uint8) << bit)

    hist, _ = np.histogram(lbp.ravel(), bins=256, range=(0, 256))
    total_lbp = lbp.size
    if total_lbp == 0:
        return 0.0
    probs = hist / float(total_lbp)
    non_zero = probs[probs > 0]
    entropy = -float(np.sum(non_zero * np.log2(non_zero)))
    return round(entropy, 4)


def _compute_8x8_blockiness(gray_array: np.ndarray) -> float:
    """
    Calculates 8x8 grid boundary discontinuity score.
    Measures the ratio of gradient intensity along 8x8 block boundaries
    versus within-block pixel gradients (indicative of DCT grid compression).
    """
    h, w = gray_array.shape
    if h < 16 or w < 16:
        return 0.0

    float_gray = gray_array.astype(np.float64)
    # Horizontal differences
    diff_h = np.abs(float_gray[:, 1:] - float_gray[:, :-1])
    # Vertical differences
    diff_v = np.abs(float_gray[1:, :] - float_gray[:-1, :])

    # Indices along 8x8 boundaries
    boundary_h_indices = np.arange(7, diff_h.shape[1], 8)
    non_boundary_h_indices = np.setdiff1d(np.arange(diff_h.shape[1]), boundary_h_indices)

    boundary_v_indices = np.arange(7, diff_v.shape[0], 8)
    non_boundary_v_indices = np.setdiff1d(np.arange(diff_v.shape[0]), boundary_v_indices)

    if len(boundary_h_indices) == 0 or len(non_boundary_h_indices) == 0:
        return 0.0

    b_h_mean = float(np.mean(diff_h[:, boundary_h_indices]))
    nb_h_mean = float(np.mean(diff_h[:, non_boundary_h_indices]))

    b_v_mean = float(np.mean(diff_v[boundary_v_indices, :]))
    nb_v_mean = float(np.mean(diff_v[non_boundary_v_indices, :]))

    # Relative excess boundary energy
    h_blockiness = (b_h_mean - nb_h_mean) / (nb_h_mean + 1e-6)
    v_blockiness = (b_v_mean - nb_v_mean) / (nb_v_mean + 1e-6)

    score = max(0.0, float((h_blockiness + v_blockiness) / 2.0))
    return round(score, 5)


def _estimate_jpeg_quality_from_qtable(qtable: np.ndarray) -> int:
    """
    Estimates JPEG quality factor (1-100) from the luminance quantization table
    by fitting against the standard IJG scaling formula:
      If Q >= 50: S = 200 - 2Q  ==>  Q = round((200 - S) / 2)
      If Q < 50:  S = 5000 / Q  ==>  Q = round(5000 / S)
    """
    if qtable.shape != (8, 8):
        return 75

    ratios = qtable / np.maximum(IJG_STANDARD_LUMINANCE_Q50, 1.0)
    median_ratio = float(np.median(ratios))

    # Scale factor S (where Q=50 corresponds to S=100)
    scale_factor = median_ratio * 100.0

    if scale_factor <= 0:
        return 100
    elif scale_factor <= 100.0:
        # Quality >= 50
        q = (200.0 - scale_factor) / 2.0
    else:
        # Quality < 50
        q = 5000.0 / scale_factor

    return max(1, min(100, int(round(q))))


def extract_metadata_features(image_path: Path, pil_image: Image.Image) -> Tuple[Dict[str, Any], Dict[str, str]]:
    """Extracts actual metadata keys, EXIF tags, and C2PA markers."""
    features: Dict[str, Any] = {
        "has_exif": False,
        "software_signature": None,
        "c2pa_manifest_present": False,
        "c2pa_signature_valid": None,
        "camera_model": None,
        "metadata_keys_present": [],
        "exif_tag_count": 0,
    }
    explanations: Dict[str, str] = {}

    # 1. EXIF inspection
    raw_exif = None
    try:
        raw_exif = pil_image.getexif()
    except Exception as exc:
        explanations["exif_error"] = str(exc)

    if raw_exif and len(raw_exif) > 0:
        features["has_exif"] = True
        features["exif_tag_count"] = len(raw_exif)
        tag_names: List[str] = []
        for tag_id, value in raw_exif.items():
            tag_name = ExifTags.TAGS.get(tag_id, f"Tag_{tag_id}")
            tag_names.append(str(tag_name))
            if tag_name == "Model":
                features["camera_model"] = str(value).strip()
            elif tag_name == "Make":
                features["camera_make"] = str(value).strip()
            elif tag_name == "Software":
                features["software_signature"] = str(value).strip()
        features["metadata_keys_present"] = tag_names
    else:
        features["has_exif"] = False
        explanations["metadata"] = (
            "No EXIF metadata found. Note: web uploaders and social media platforms routinely "
            "strip metadata during transcoding; absence of EXIF does not indicate tampering."
        )

    # 2. Check for C2PA / Content Credentials in raw container bytes
    try:
        with open(image_path, "rb") as f:
            header_sample = f.read(131072)  # inspect first 128 KB
            if b"c2pa" in header_sample or b"jumb" in header_sample:
                features["c2pa_manifest_present"] = True
                features["c2pa_signature_valid"] = None
                explanations["c2pa"] = "C2PA box detected; cryptographic validation requires C2PA trust store."
            else:
                features["c2pa_manifest_present"] = False
                features["c2pa_signature_valid"] = None
    except Exception as exc:
        features["c2pa_manifest_present"] = False
        explanations["c2pa_read_error"] = str(exc)

    return features, explanations


def extract_jpeg_features(image_path: Path, pil_image: Image.Image, gray_array: np.ndarray) -> Tuple[Dict[str, Any], Dict[str, str]]:
    """Extracts JPEG quantization tables, estimated quality, and 8x8 blockiness."""
    features: Dict[str, Any] = {
        "quantization_table_match": None,
        "estimated_quality": None,
        "double_compression_detected": None,
        "blockiness_8x8_score": None,
        "quantization_tables_present": 0,
    }
    explanations: Dict[str, str] = {}

    is_jpeg = pil_image.format in ("JPEG", "JPG") or image_path.suffix.lower() in (".jpg", ".jpeg")

    # 8x8 Blockiness can be computed on any raster image
    features["blockiness_8x8_score"] = _compute_8x8_blockiness(gray_array)

    if not is_jpeg:
        explanations["jpeg"] = f"Image format is '{pil_image.format}', not JPEG; quantization tables are not present."
        return features, explanations

    # Check for Pillow quantization tables
    quant_tables = getattr(pil_image, "quantization", None)
    if quant_tables and isinstance(quant_tables, dict) and len(quant_tables) > 0:
        features["quantization_tables_present"] = len(quant_tables)
        # Table 0 is standard luminance
        if 0 in quant_tables:
            raw_t0 = np.array(quant_tables[0], dtype=np.float64).reshape((8, 8))
            estimated_q = _estimate_jpeg_quality_from_qtable(raw_t0)
            features["estimated_quality"] = estimated_q
            features["quantization_table_match"] = "standard_ijg_fit"
    else:
        explanations["quantization"] = (
            "JPEG quantization table was not exposed by the decoder (image was loaded as decompressed bitmap)."
        )

    # Double compression indicator
    # Deterministic double compression detection requires DCT coefficient stream or re-compression error histogram
    features["double_compression_detected"] = None
    explanations["double_compression"] = (
        "Double-compression requires raw DCT stream analysis; uncompressed raster pixels cannot "
        "deterministically confirm double compression without DCT bitstream."
    )

    return features, explanations


def extract_noise_features(gray_array: np.ndarray) -> Tuple[Dict[str, Any], Dict[str, str]]:
    """
    Computes empirical spatial noise residual features using a 3x3 median filter.
    Calculates residual variance, standard deviation, SNR, and quadrant uniformity.
    """
    features: Dict[str, Any] = {
        "residual_variance": None,
        "quadrant_variance_uniformity": None,
        "prnu_correlation": None,
        "noise_snr_db": None,
        "residual_mean": None,
        "residual_std": None,
    }
    explanations: Dict[str, str] = {}

    h, w = gray_array.shape
    if h < 8 or w < 8:
        explanations["noise"] = "Image too small for noise residual extraction."
        return features, explanations

    float_gray = gray_array.astype(np.float64)

    # Denoise using 3x3 median filter to isolate high-frequency spatial noise residual
    denoised = cv2.medianBlur(gray_array, 3).astype(np.float64)
    residual = float_gray - denoised

    res_mean = float(np.mean(residual))
    res_var = float(np.var(residual))
    res_std = float(np.std(residual))

    features["residual_mean"] = round(res_mean, 5)
    features["residual_variance"] = round(res_var, 5)
    features["residual_std"] = round(res_std, 5)

    # Estimate Signal-to-Noise Ratio (SNR) in decibels
    signal_power = float(np.var(denoised))
    if res_var > 1e-9:
        snr_linear = signal_power / res_var
        features["noise_snr_db"] = round(float(10.0 * math.log10(max(snr_linear, 1e-6))), 2)
    else:
        features["noise_snr_db"] = None
        explanations["snr"] = "Residual noise variance is virtually zero (flat or synthesized solid color)."

    # Quadrant variance uniformity: divide into 4 quadrants
    mid_y, mid_x = h // 2, w // 2
    quadrants = [
        residual[:mid_y, :mid_x],
        residual[:mid_y, mid_x:],
        residual[mid_y:, :mid_x],
        residual[mid_y:, mid_x:],
    ]
    quad_vars = [float(np.var(q)) for q in quadrants]
    min_v, max_v = min(quad_vars), max(quad_vars)
    if max_v > 1e-9:
        features["quadrant_variance_uniformity"] = round(float(min_v / max_v), 4)
    else:
        features["quadrant_variance_uniformity"] = 1.0

    # PRNU requires camera sensor reference profile
    features["prnu_correlation"] = None
    explanations["prnu"] = (
        "PRNU correlation requires a reference physical camera sensor noise profile database."
    )

    return features, explanations


def extract_frequency_features(gray_array: np.ndarray) -> Tuple[Dict[str, Any], Dict[str, str]]:
    """
    Computes 2D Fast Fourier Transform (FFT) spectral energy distributions.
    Measures low vs high frequency energy, spectral ratio, and azimuthal decay rate.
    """
    features: Dict[str, Any] = {
        "spectral_rolloff_hz": None,
        "high_frequency_decay_rate": None,
        "azimuthal_average_anomaly": None,
        "grid_peak_energy": None,
        "fft_low_frequency_energy": None,
        "fft_high_frequency_energy": None,
        "spectral_ratio": None,
    }
    explanations: Dict[str, str] = {}

    h, w = gray_array.shape
    if h < 8 or w < 8:
        explanations["frequency"] = "Image dimensions too small for 2D FFT computation."
        return features, explanations

    # 2D FFT centered
    f_transform = np.fft.fftshift(np.fft.fft2(gray_array.astype(np.float64)))
    magnitude_spectrum = np.abs(f_transform)
    power_spectrum = magnitude_spectrum ** 2
    total_energy = float(np.sum(power_spectrum))

    if total_energy < 1e-9:
        explanations["frequency"] = "Image has zero spectral variance."
        return features, explanations

    # Coordinate grid from center
    cy, cx = h // 2, w // 2
    y_coords, x_coords = np.ogrid[:h, :w]
    radii = np.sqrt((y_coords - cy) ** 2 + (x_coords - cx) ** 2)
    max_radius = float(np.max(radii))

    if max_radius < 1.0:
        return features, explanations

    # Low frequency: inner 25% radius; High frequency: outer > 50% radius
    low_freq_mask = radii <= (0.25 * max_radius)
    high_freq_mask = radii > (0.50 * max_radius)

    low_energy = float(np.sum(power_spectrum[low_freq_mask]))
    high_energy = float(np.sum(power_spectrum[high_freq_mask]))

    features["fft_low_frequency_energy"] = round(low_energy, 2)
    features["fft_high_frequency_energy"] = round(high_energy, 2)
    features["spectral_ratio"] = round(float(high_energy / (low_energy + 1e-9)), 6)

    # High frequency decay rate (linear regression of log power vs log radial distance)
    # Natural images obey power-law decay P(r) ~ r^(-alpha) with alpha in ~[1.5, 3.0]
    num_bins = min(64, int(max_radius) // 2)
    if num_bins >= 8:
        bin_edges = np.linspace(2.0, max_radius * 0.9, num_bins + 1)
        radial_powers: List[float] = []
        radial_r: List[float] = []

        for i in range(num_bins):
            r_mask = (radii >= bin_edges[i]) & (radii < bin_edges[i + 1])
            if np.any(r_mask):
                radial_powers.append(float(np.mean(power_spectrum[r_mask])))
                radial_r.append(float((bin_edges[i] + bin_edges[i + 1]) / 2.0))

        if len(radial_powers) >= 6:
            log_r = np.log(np.array(radial_r) + 1e-6)
            log_p = np.log(np.array(radial_powers) + 1e-6)
            # Linear fit: log(P) = -alpha * log(r) + c
            coeffs = np.polyfit(log_r, log_p, deg=1)
            # Slope is negative in natural images; decay rate alpha is -slope
            features["high_frequency_decay_rate"] = round(float(-coeffs[0]), 3)

    # Grid peak energy: measures periodic spectral spikes characteristic of GAN upsampling
    # Ratio of max high-frequency spike to median high-frequency energy
    if np.any(high_freq_mask):
        hf_vals = power_spectrum[high_freq_mask]
        median_hf = float(np.median(hf_vals))
        max_hf = float(np.max(hf_vals))
        if median_hf > 1e-9:
            features["grid_peak_energy"] = round(float(max_hf / median_hf), 3)
        else:
            features["grid_peak_energy"] = 1.0

    features["spectral_rolloff_hz"] = None
    explanations["spectral_rolloff"] = "Spectral rolloff in Hertz is specific to 1D acoustic signals, not spatial 2D images."

    return features, explanations


def extract_edge_features(gray_array: np.ndarray) -> Tuple[Dict[str, Any], Dict[str, str]]:
    """
    Computes Sobel gradient statistics, Canny edge density, and boundary discontinuity index.
    """
    features: Dict[str, Any] = {
        "gradient_mean": None,
        "gradient_std": None,
        "boundary_discontinuity_index": None,
        "sobel_gradient_max": None,
        "canny_edge_density": None,
    }
    explanations: Dict[str, str] = {}

    h, w = gray_array.shape
    if h < 4 or w < 4:
        explanations["edges"] = "Image too small for gradient extraction."
        return features, explanations

    # Sobel Gradients
    sobel_x = cv2.Sobel(gray_array, cv2.CV_64F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(gray_array, cv2.CV_64F, 0, 1, ksize=3)
    gradient_mag = np.sqrt(sobel_x ** 2 + sobel_y ** 2)

    features["gradient_mean"] = round(float(np.mean(gradient_mag)), 3)
    features["gradient_std"] = round(float(np.std(gradient_mag)), 3)
    features["sobel_gradient_max"] = round(float(np.max(gradient_mag)), 3)

    # Canny Edge Density
    edges = cv2.Canny(gray_array, threshold1=50, threshold2=150)
    edge_pixel_count = int(np.count_nonzero(edges))
    features["canny_edge_density"] = round(float(edge_pixel_count / gray_array.size), 4)

    # Boundary Discontinuity Index: ratio of perimeter edge gradient to interior gradient
    border_width = max(1, min(h, w) // 16)
    interior = gradient_mag[border_width : h - border_width, border_width : w - border_width]
    if interior.size > 0:
        border_mask = np.ones((h, w), dtype=bool)
        border_mask[border_width : h - border_width, border_width : w - border_width] = False
        border_mean = float(np.mean(gradient_mag[border_mask]))
        interior_mean = float(np.mean(interior))
        features["boundary_discontinuity_index"] = round(
            float(border_mean / (interior_mean + 1e-6)), 4
        )
    else:
        features["boundary_discontinuity_index"] = 1.0

    return features, explanations


def extract_texture_features(gray_array: np.ndarray) -> Tuple[Dict[str, Any], Dict[str, str]]:
    """
    Computes Shannon entropy, Local Binary Pattern (LBP) entropy, and GLCM contrast.
    """
    features: Dict[str, Any] = {
        "shannon_entropy": None,
        "local_binary_pattern_entropy": None,
        "glcm_contrast": None,
        "local_variance_mean": None,
    }
    explanations: Dict[str, str] = {}

    h, w = gray_array.shape
    if h < 4 or w < 4:
        explanations["texture"] = "Image too small for texture extraction."
        return features, explanations

    # Grayscale Shannon Entropy (0-8 bits)
    features["shannon_entropy"] = _compute_shannon_entropy(gray_array)

    # LBP Texture Entropy
    features["local_binary_pattern_entropy"] = _compute_lbp_entropy(gray_array)

    # Local variance (variance of 5x5 neighborhoods)
    mean_filter = cv2.blur(gray_array.astype(np.float64), (5, 5))
    sq_filter = cv2.blur(gray_array.astype(np.float64) ** 2, (5, 5))
    local_var = np.maximum(0.0, sq_filter - mean_filter ** 2)
    features["local_variance_mean"] = round(float(np.mean(local_var)), 3)

    # GLCM Horizontal Contrast: sum_{i,j} |i - j|^2 * P(i, j)
    # Using horizontal neighbor pairs (offset: (0, 1))
    left = gray_array[:, :-1].astype(np.int32)
    right = gray_array[:, 1:].astype(np.int32)
    diff_sq = (left - right) ** 2
    features["glcm_contrast"] = round(float(np.mean(diff_sq)), 3)

    return features, explanations


def extract_compression_features(image_path: Path, pil_image: Image.Image) -> Tuple[Dict[str, Any], Dict[str, str]]:
    """
    Computes container parameters, dimensions, aspect ratio, and codec format.
    """
    features: Dict[str, Any] = {
        "codec": pil_image.format.lower() if pil_image.format else None,
        "bitrate_kbps": None,
        "macroblock_jitter": None,
        "recompression_count_estimate": None,
        "file_size_bytes": os.path.getsize(image_path),
        "width": pil_image.width,
        "height": pil_image.height,
        "aspect_ratio": round(float(pil_image.width / max(1, pil_image.height)), 4),
        "color_mode": pil_image.mode,
    }
    explanations: Dict[str, str] = {
        "bitrate_kbps": "Bitrate parameter is specific to streaming temporal video/audio containers, not static images.",
        "macroblock_jitter": "Macroblock motion jitter is specific to temporal video GOP vectors, not static images."
    }

    return features, explanations


def extract_forensic_features(image_path: Union[str, Path]) -> Dict[str, Any]:
    """
    Primary entry point: extracts structured forensic features for an image.
    Conforms directly to the forensic_ml.forensic_features contract in schemas/evidence-bundle.json.

    Args:
        image_path: File system path to the image file.

    Returns:
        Structured dictionary containing:
        - available: bool
        - image_path: str
        - forensic_features: dict conforming to EvidenceBundle schema
        - feature_explanations: dict explaining unavailable features or methodology
    """
    path = Path(image_path).resolve()
    if not path.is_file():
        raise FileNotFoundError(f"Image file does not exist: {path}")

    # Load with Pillow to extract container/metadata/quantization
    try:
        with Image.open(path) as pil_img:
            # Load image data into memory before context exit
            pil_img.load()
            pil_format = pil_img.format
            pil_mode = pil_img.mode
            pil_size = pil_img.size

            # Handle palette/transparency cleanly before standardizing to RGB
            if pil_mode == "P" and "transparency" in pil_img.info:
                rgba_img = pil_img.convert("RGBA")
                rgb_img = rgba_img.convert("RGB")
            elif pil_mode != "RGB":
                rgb_img = pil_img.convert("RGB")
            else:
                rgb_img = pil_img

            np_rgb = np.array(rgb_img)
            # Grayscale conversion: ITU-R BT.601 standard
            gray_array = cv2.cvtColor(np_rgb, cv2.COLOR_RGB2GRAY)

            # 1. Metadata
            meta_feats, meta_expl = extract_metadata_features(path, pil_img)

            # 2. JPEG
            jpeg_feats, jpeg_expl = extract_jpeg_features(path, pil_img, gray_array)

            # 3. Compression
            comp_feats, comp_expl = extract_compression_features(path, pil_img)

    except Exception as exc:
        raise ValueError(f"Failed to read image at {path}: {exc}") from exc

    # 4. Noise
    noise_feats, noise_expl = extract_noise_features(gray_array)

    # 5. Frequency
    freq_feats, freq_expl = extract_frequency_features(gray_array)

    # 6. Edges
    edge_feats, edge_expl = extract_edge_features(gray_array)

    # 7. Texture
    texture_feats, texture_expl = extract_texture_features(gray_array)

    # Aggregate explanations
    all_explanations: Dict[str, str] = {}
    all_explanations.update(meta_expl)
    all_explanations.update(jpeg_expl)
    all_explanations.update(comp_expl)
    all_explanations.update(noise_expl)
    all_explanations.update(freq_expl)
    all_explanations.update(edge_expl)
    all_explanations.update(texture_expl)

    return {
        "available": True,
        "image_path": str(path),
        "forensic_features": {
            "jpeg": jpeg_feats,
            "noise": noise_feats,
            "frequency": freq_feats,
            "edges": edge_feats,
            "texture": texture_feats,
            "compression": comp_feats,
            "metadata": meta_feats,
        },
        "feature_explanations": all_explanations,
    }


if __name__ == "__main__":
    import json
    import sys

    if len(sys.argv) > 1:
        target = sys.argv[1]
    else:
        # Default fallback test on an existing repo asset if run directly
        target = "src/assets/hero.png"

    try:
        results = extract_forensic_features(target)
        print(json.dumps(results, indent=2))
    except Exception as err:
        print(f"Error extracting features: {err}", file=sys.stderr)
        sys.exit(1)
