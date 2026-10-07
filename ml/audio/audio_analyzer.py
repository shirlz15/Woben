"""
FORENSIGHT - Audio Forensic Analyzer
Extracts real, deterministic audio forensic signals from audio/video files.
FORENSIC PRINCIPLES:
- Every value is a directly computed measurement.
- No synthetic-voice detector claims without an actual validated model.
- Temporal events are only reported when actually detected.
"""
from __future__ import annotations
import datetime, hashlib, json, math, struct, sys, wave, subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

try:
    import soundfile as sf
    _SOUNDFILE_AVAILABLE = True
except ImportError:
    _SOUNDFILE_AVAILABLE = False


def _run_ffprobe(file_path: Path) -> Dict[str, Any]:
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json",
             "-show_streams", "-show_format", str(file_path)],
            capture_output=True, text=True, timeout=10)
        if r.returncode == 0:
            return json.loads(r.stdout)
    except Exception:
        pass
    return {}


def _read_wav_numpy(file_path: Path) -> Tuple[Optional[np.ndarray], int, int]:
    try:
        with wave.open(str(file_path), "rb") as wf:
            n_channels = wf.getnchannels()
            sampwidth = wf.getsampwidth()
            framerate = wf.getframerate()
            n_frames = wf.getnframes()
            if n_frames == 0 or framerate == 0:
                return None, 0, 0
            raw = wf.readframes(n_frames)
        if sampwidth == 1:
            s = np.frombuffer(raw, dtype=np.uint8).astype(np.float32)
            s = (s - 128.0) / 128.0
        elif sampwidth == 2:
            s = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        elif sampwidth == 4:
            s = np.frombuffer(raw, dtype=np.int32).astype(np.float32) / 2147483648.0
        else:
            return None, 0, 0
        if n_channels > 1:
            s = s.reshape(-1, n_channels)
        return s, framerate, n_channels
    except Exception:
        return None, 0, 0


def _load_audio(file_path: Path) -> Tuple[Optional[np.ndarray], int, int]:
    if _SOUNDFILE_AVAILABLE:
        try:
            data, sr = sf.read(str(file_path), dtype="float32", always_2d=False)
            channels = 1 if data.ndim == 1 else data.shape[1]
            return data, sr, channels
        except Exception:
            pass
    return _read_wav_numpy(file_path)


def _to_mono(samples: np.ndarray) -> np.ndarray:
    if samples.ndim == 1:
        return samples
    return np.mean(samples, axis=1)


def _compute_spectral_features(mono: np.ndarray, sr: int) -> Dict[str, Any]:
    features: Dict[str, Any] = {
        "spectral_centroid_hz": None,
        "spectral_bandwidth_hz": None,
        "spectral_flatness": None,
        "spectral_rolloff_hz": None,
        "low_freq_energy_fraction": None,
        "mid_freq_energy_fraction": None,
        "high_freq_energy_fraction": None,
    }
    if len(mono) < 512 or sr == 0:
        return features
    segment = mono[:min(len(mono), sr * 30)]
    n_fft = 2048
    hop = n_fft // 4
    n_frames = (len(segment) - n_fft) // hop
    if n_frames < 1:
        return features
    power_acc = np.zeros(n_fft // 2 + 1, dtype=np.float64)
    freqs = np.fft.rfftfreq(n_fft, d=1.0 / sr)
    window = np.hanning(n_fft)
    count = 0
    for i in range(min(n_frames, 200)):
        start = i * hop
        frame = segment[start:start + n_fft] * window
        spec = np.abs(np.fft.rfft(frame)) ** 2
        power_acc += spec
        count += 1
    if count == 0:
        return features
    power_avg = power_acc / count
    total_power = float(np.sum(power_avg))
    if total_power < 1e-12:
        return features
    centroid = float(np.sum(freqs * power_avg) / total_power)
    features["spectral_centroid_hz"] = round(centroid, 1)
    bandwidth = float(np.sqrt(np.sum(((freqs - centroid) ** 2) * power_avg) / total_power))
    features["spectral_bandwidth_hz"] = round(bandwidth, 1)
    log_mean = float(np.mean(np.log(power_avg + 1e-12)))
    arith_mean = float(np.mean(power_avg))
    flatness = float(np.exp(log_mean) / (arith_mean + 1e-12))
    features["spectral_flatness"] = round(min(1.0, flatness), 6)
    cumulative = np.cumsum(power_avg)
    rolloff_idx = int(np.searchsorted(cumulative, 0.95 * total_power))
    if rolloff_idx < len(freqs):
        features["spectral_rolloff_hz"] = round(float(freqs[rolloff_idx]), 1)
    low_mask = freqs <= 300
    mid_mask = (freqs > 300) & (freqs <= 3000)
    high_mask = freqs > 3000
    features["low_freq_energy_fraction"] = round(float(np.sum(power_avg[low_mask]) / total_power), 4)
    features["mid_freq_energy_fraction"] = round(float(np.sum(power_avg[mid_mask]) / total_power), 4)
    features["high_freq_energy_fraction"] = round(float(np.sum(power_avg[high_mask]) / total_power), 4)
    return features


def _detect_temporal_anomalies(mono: np.ndarray, sr: int, window_sec: float = 0.5) -> List[Dict[str, Any]]:
    events: List[Dict[str, Any]] = []
    if sr == 0 or len(mono) < sr:
        return events
    window_samples = int(window_sec * sr)
    n_windows = len(mono) // window_samples
    if n_windows < 4:
        return events
    window_rms = []
    for i in range(n_windows):
        start = i * window_samples
        rms = float(np.sqrt(np.mean(mono[start:start + window_samples] ** 2)))
        window_rms.append(rms)
    for i in range(1, len(window_rms)):
        ts_sec = round(i * window_sec, 2)
        prev_rms = window_rms[i - 1]
        curr_rms = window_rms[i]
        if prev_rms > 1e-5 and curr_rms > 1e-5:
            ratio = curr_rms / max(prev_rms, 1e-9)
            if ratio > 4.0 or ratio < 0.25:
                events.append({
                    "timestamp_sec": ts_sec,
                    "type": "ABRUPT_ENERGY_CHANGE",
                    "measured_delta": round(float(abs(curr_rms - prev_rms)), 5),
                    "ratio": round(ratio, 3),
                    "description": "Energy ratio {:.2f}x between adjacent windows at {}s - possible splice boundary.".format(ratio, ts_sec),
                })
        if curr_rms < 1e-4 and prev_rms > 0.01:
            events.append({
                "timestamp_sec": ts_sec,
                "type": "SILENCE_INSERTION",
                "measured_delta": round(prev_rms, 5),
                "description": "Near-silence segment at {}s following active audio - potential cut/insertion point.".format(ts_sec),
            })
    return sorted(events, key=lambda e: e.get("measured_delta", 0), reverse=True)[:10]


def _extract_container_metadata(file_path: Path) -> Dict[str, Any]:
    meta: Dict[str, Any] = {
        "codec": None, "container_format": None, "sample_rate": None,
        "channels": None, "bit_depth": None, "bit_rate_kbps": None, "duration_sec": None
    }
    probe = _run_ffprobe(file_path)
    if probe:
        fmt = probe.get("format", {})
        meta["container_format"] = fmt.get("format_name")
        try:
            meta["duration_sec"] = round(float(fmt.get("duration", 0) or 0), 3)
        except Exception:
            pass
        try:
            br = fmt.get("bit_rate")
            if br:
                meta["bit_rate_kbps"] = round(float(br) / 1000.0, 1)
        except Exception:
            pass
        for stream in probe.get("streams", []):
            if stream.get("codec_type") == "audio":
                meta["codec"] = stream.get("codec_name")
                try:
                    meta["sample_rate"] = int(stream.get("sample_rate", 0) or 0)
                except Exception:
                    pass
                try:
                    meta["channels"] = int(stream.get("channels", 0) or 0)
                except Exception:
                    pass
                meta["bit_depth"] = stream.get("bits_per_sample") or stream.get("bits_per_raw_sample")
                break
    return meta


def analyze_audio(
    file_path: Union[str, Path],
    media_id: Optional[str] = None,
    source_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Complete audio forensic analysis pipeline."""
    path = Path(file_path).resolve()
    if not path.is_file():
        raise FileNotFoundError("Audio file does not exist: {}".format(path))

    file_sha256 = hashlib.sha256(path.read_bytes()).hexdigest()[:12]
    bundle_id = "bundle-aud-{}".format(file_sha256)
    effective_media_id = media_id or "media-aud-{}".format(file_sha256)
    created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    limitations: List[str] = []
    feature_explanations: Dict[str, str] = {}

    container_meta = _extract_container_metadata(path)
    samples, sr, channels = _load_audio(path)

    if samples is None or sr == 0:
        limitations.append("Audio samples could not be decoded. Waveform and spectral analysis UNAVAILABLE.")
        mono = None
        sr_effective = container_meta.get("sample_rate") or 0
    else:
        mono = _to_mono(samples)
        sr_effective = sr
        container_meta["sample_rate"] = sr
        container_meta["channels"] = channels

    waveform_features: Dict[str, Any] = {
        "available": mono is not None,
        "rms_energy": None, "amplitude_max": None, "amplitude_min": None,
        "dc_offset": None, "clipping_ratio": None, "dynamic_range_db": None,
    }
    if mono is not None:
        waveform_features["rms_energy"] = round(float(np.sqrt(np.mean(mono ** 2))), 6)
        waveform_features["amplitude_max"] = round(float(np.max(np.abs(mono))), 6)
        waveform_features["amplitude_min"] = round(float(np.min(np.abs(mono))), 6)
        waveform_features["dc_offset"] = round(float(np.mean(mono)), 6)
        waveform_features["clipping_ratio"] = round(float(np.sum(np.abs(mono) >= 0.99) / len(mono)), 6)
        abs_mono = np.abs(mono)
        peak = float(np.percentile(abs_mono, 95))
        floor_val = float(np.percentile(abs_mono, 5))
        if floor_val > 1e-9 and peak > 1e-9:
            waveform_features["dynamic_range_db"] = round(float(20.0 * math.log10(peak / max(floor_val, 1e-9))), 2)

    spectral_features: Dict[str, Any] = {"available": mono is not None and sr_effective > 0}
    if mono is not None and sr_effective > 0:
        spectral_features.update(_compute_spectral_features(mono, sr_effective))

    temporal_events: List[Dict[str, Any]] = []
    temporal_available = False
    if mono is not None and sr_effective > 0:
        temporal_events = _detect_temporal_anomalies(mono, sr_effective)
        temporal_available = True

    synthetic_voice_detection = {
        "available": False,
        "reason": "No validated synthetic-voice detector is integrated. Requires a trained, validated model.",
        "result": None,
    }

    digital_provenance = {
        "c2pa_present": False,
        "c2pa_valid": None,
        "note": "C2PA content credentials in audio containers are not widely deployed. No signature found.",
    }
    try:
        with open(path, "rb") as f:
            header = f.read(65536)
            if b"c2pa" in header or b"jumb" in header:
                digital_provenance["c2pa_present"] = True
                digital_provenance["note"] = "C2PA box detected; cryptographic validation requires C2PA trust store."
    except Exception:
        pass

    duration_sec = container_meta.get("duration_sec")
    if duration_sec is None and mono is not None and sr_effective > 0:
        duration_sec = round(len(mono) / sr_effective, 3)
        container_meta["duration_sec"] = duration_sec

    fusion_reasons = [
        "Audio forensics provides waveform and spectral measurements. No validated synthetic-voice model is integrated.",
    ]
    if temporal_events:
        fusion_reasons.append("Detected {} temporal anomaly event(s): potential splice boundaries.".format(len(temporal_events)))
    else:
        fusion_reasons.append("No abrupt temporal energy discontinuities detected in analyzed segments.")

    return {
        "schema_version": "1.0.0",
        "bundle_id": bundle_id,
        "created_at": created_at,
        "media": {
            "media_id": effective_media_id,
            "modality": "AUDIO",
            "mime_type": "audio/{}".format(path.suffix.lstrip(".").lower() or "unknown"),
            "source": source_url or str(path),
            "access_status": "ACCESSIBLE",
            "duration_sec": duration_sec,
        },
        "audio_forensics": {
            "available": True,
            "container": container_meta,
            "waveform": waveform_features,
            "spectral": spectral_features,
            "temporal_events": {
                "available": temporal_available,
                "events": temporal_events,
                "event_count": len(temporal_events),
            },
            "synthetic_voice_detection": synthetic_voice_detection,
            "digital_provenance": digital_provenance,
        },
        "cross_modal": {
            "available": False,
            "note": "Audio-visual cross-modal consistency requires synchronized video analysis.",
        },
        "limitations": limitations,
        "feature_explanations": feature_explanations,
        "fusion": {
            "final_verdict": "INCONCLUSIVE",
            "status": "INSUFFICIENT_EVIDENCE",
            "agreement": False,
            "conflict": False,
            "reasons": fusion_reasons,
        },
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python audio_analyzer.py <audio_file>", file=sys.stderr)
        sys.exit(1)
    try:
        result = analyze_audio(sys.argv[1])
        print(json.dumps(result, indent=2))
    except Exception as err:
        print("Audio analysis error: {}".format(err), file=sys.stderr)
        sys.exit(1)
