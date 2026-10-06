# FORENSIGHT — Digital Forensics & Multimodal Media Integrity System

<div align="center">

![FORENSIGHT Banner](src/assets/hero.png)

**A professional-grade digital forensics workstation and browser extension for real-time deepfake detection, synthetic media verification, and multimodal evidence provenance.**

[![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-MV3_Compliant-4285F4?logo=googlechrome&logoColor=white)](extension/manifest.json)
[![Side Panel API](https://img.shields.io/badge/Chrome_API-Side_Panel-34A853)](extension/sidepanel/index.html)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Production_Ready-success.svg)](#)

</div>

---

## 🔬 Overview

**FORENSIGHT** transforms any Chromium-based browser into an advanced forensic investigation laboratory. Instead of presenting black-box confidence scores (e.g. *"91% Fake"*), FORENSIGHT visually unpacks the entire forensic chain of custody:

```
MEDIA IN CURRENT TAB
        ↓
MULTI-MODAL FORENSIC SIGNALS (Spatial, Frequency, Audio, Temporal, Metadata)
        ↓
EVIDENCE RELATIONSHIPS & CONSTELLATION MAPPING
        ↓
PERTURBATION & RE-ENCODING STABILITY TESTING
        ↓
EXPLAINABLE AUDIT-READY VERDICT & REPORT DOSSIER
```

---

## ✨ Key Features

### 1. 🧩 Chrome MV3 Browser Extension & Side Panel
- **Manifest V3 Architecture**: Built with modern Chrome extension standards, leveraging service workers, side panels, and content scripts.
- **Side Panel Workstation**: Opens directly alongside active browser tabs without obscuring web content or interrupting user browsing.
- **Tab-Aware Media Discovery**: Automatically tracks all images, videos, audio elements, and background media rendered in the active viewport.
- **Non-Invasive On-Page Badges**: Overlays subtle, interactive forensic badges directly on media elements with one-click side panel inspection.

### 2. 🔍 Multi-Signal Forensic Analysis Engine
- **Spatial Artifacts**: Detects pixel grid warping, boundary discontinuities, blending seams, and generative artifact signatures.
- **Frequency Domain (FFT/DCT)**: Uncovers high-frequency power spectrum anomalies characteristic of diffusion models and GAN upsamplers.
- **Sensor PRNU Fingerprinting**: Validates Photo-Response Non-Uniformity noise signatures against physical camera sensor profiles.
- **Noise Residual Consistency**: Analyzes local standard deviation of residual noise across color channels.
- **Temporal & Optical Flow**: Tracks frame-to-frame coherence, temporal flickering, and warping in video streams.
- **Audio Spectral & Voice Biometrics**: Cross-examines vocal tract resonances, harmonic structures, and synthetic speech synthesis artifacts.
- **Cross-Modal AV Lip-Sync**: Measures audio-visual synchrony and phoneme-viseme correlation to catch AI audio dubbing.
- **Metadata & Provenance Verification**: Inspects EXIF tags, compression quantization tables, and C2PA Content Credentials.

### 3. 🌐 Evidence Constellation & Cross-Modal Corroboration
- Real-time radial node visualization showing agreement, tension, and consensus among independent forensic signals.
- Transparent conflict reasoning explaining when and why signals might disagree (e.g., heavy platform recompression vs. deliberate manipulation).

### 4. 🛡️ Perturbation & Stability Profiling
- Tests detection robustness across 4 common transmission perturbations:
  - **Re-compression** (H.264/JPEG quantization)
  - **Downsampling** (Social media thumbnailing)
  - **Noise Injection** (Additive Gaussian / platform noise)
  - **Gaussian Blur** (Smoothing filters)
- Computes an aggregate **Stability Score** indicating confidence survivability in real-world broadcast pipelines.

### 5. 📑 Forensic Dossier Export
- **One-Click Audit-Ready PDF**: Formatted forensic brief with verdict, chain of custody, signal matrices, and inspector sign-off.
- **Structured JSON Export**: Machine-readable forensic telemetry for integration into SIEM, fact-checking workflows, or threat intelligence platforms.

### 6. 📱 Realistic "Pulse" Social Media Simulation
- Complete mock social media network with news feeds, creator posts, AI generated videos, podcasts, and authenticated photojournalism for testing without third-party platform rate limits or API keys.

---

## 📂 Project Architecture

```
Woben/
├── extension/                       # Chrome Manifest V3 Extension
│   ├── manifest.json                # MV3 Manifest with sidePanel & scripting
│   ├── background/
│   │   └── service-worker.js        # Tab tracking, side panel lifecycle & coordination
│   ├── content/
│   │   ├── content.js               # In-page media detection & interactive badge overlays
│   │   └── styles.css               # In-page badge styling and micro-animations
│   ├── sidepanel/
│   │   ├── index.html               # Side panel layout
│   │   ├── app.js                   # State manager & controller
│   │   ├── components.js            # Forensic UI components
│   │   ├── report-generator.js      # Audit PDF & JSON export engine
│   │   └── styles.css               # Modern dark-mode forensic styling
│   ├── assets/                      # High-res extension icons (16, 32, 48, 128px)
│   └── demo/
│       └── social-feed.html         # "Pulse" Realistic Social Media Platform Demo
├── src/                             # Standalone Web Application & Forensic Workstation
│   ├── components/                  # Modals, viewers, signal bars, and constellation maps
│   ├── models/                      # Forensic dataset definitions and analytical models
│   ├── styles/                      # Design tokens and modular stylesheets
│   └── main.js                      # Web app bootstrap
├── public/                          # Static assets and icons
├── index.html                       # Standalone workstation entry point
└── package.json                     # Vite, scripts, and build configuration
```

---

## 🚀 Quick Start Guide

### Option A: Loading the Chrome Extension

1. Open Google Chrome (or any Chromium browser such as Brave, Edge, or Opera).
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** in the top left corner.
5. Select the `extension/` folder located in this repository:
   ```
   c:\Users\Sam Arul\woben\Woben\extension
   ```
6. The **FORENSIGHT** extension icon will now appear in your browser toolbar.
7. Click the extension icon or use the action shortcut to open the **Side Panel**.
8. Navigate to any webpage (or open `extension/demo/social-feed.html` in your browser) to begin live forensic inspection!

---

### Option B: Running the Standalone Forensic Workstation

To run the standalone web application with Vite:

```bash
# 1. Install dependencies (if not already installed)
npm install

# 2. Start Vite development server
npm run dev
```

Visit `http://localhost:5173` to explore the full-screen forensic analysis interface.

---

## 🧪 Testing with the Realistic Social Feed

To test FORENSIGHT against realistic media:

1. With the extension loaded, open `extension/demo/social-feed.html` in Chrome:
   ```
   file:///c:/Users/Sam Arul/woben/Woben/extension/demo/social-feed.html
   ```
2. The page simulates **"Pulse"**, a clean, modern social platform containing:
   - High-resolution authentic photojournalism
   - Synthetic GAN/Diffusion portraits
   - AI news anchors with manipulated lip synchrony
   - Cloned audio voice clips
   - Recompressed and platform-filtered images
3. Notice the subtle badge indicators in the corner of each media item.
4. Click any badge or click the FORENSIGHT icon to view the deep forensic breakdown in the Side Panel.

---

## 🛠️ Technology Stack

- **Extension Framework**: Chrome Extensions Manifest V3 (MV3)
- **APIs**: Chrome Side Panel API (`chrome.sidePanel`), Tabs, Scripting, Runtime
- **Frontend / Styling**: Vanilla JavaScript (ES Modules), Custom Forensic CSS Design System
- **Visualization**: Canvas-based Evidence Constellation, High-frequency Spectral FFT Renderers
- **Build & Dev Tooling**: Node.js, Vite

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
