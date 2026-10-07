/**
 * FORENSIGHT — Image Forensic Signal Extractor (Phase 2)
 * 
 * Computes empirical evidence directly from measurable image bytes and pixels:
 * - Metadata & EXIF inspection (actual tags without fabrication)
 * - Compression & 8x8 block boundary analysis
 * - Channel statistics & Shannon entropy
 * - Laplacian residual noise & spatial quadrant variance
 * - Sobel edge gradients & sharpness distribution
 */

import { Buffer } from 'node:buffer';

/**
 * Inspects binary image buffer for format, headers, and EXIF tags.
 */
export function inspectImageBinary(buffer) {
  if (!buffer || buffer.length < 8) {
    return {
      mimeType: 'application/octet-stream',
      format: 'UNKNOWN',
      fileSize: buffer ? buffer.length : 0,
      hasExif: false,
      fields: {},
    };
  }

  const fileSize = buffer.length;
  let format = 'UNKNOWN';
  let mimeType = 'application/octet-stream';

  // Magic bytes check
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    format = 'JPEG';
    mimeType = 'image/jpeg';
  } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    format = 'PNG';
    mimeType = 'image/png';
  } else if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    format = 'WEBP';
    mimeType = 'image/webp';
  } else if (buffer.toString('ascii', 0, 3) === 'GIF') {
    format = 'GIF';
    mimeType = 'image/gif';
  }

  // Parse EXIF if JPEG
  const exif = format === 'JPEG' ? extractJpegExif(buffer) : { hasExif: false, fields: {} };

  return {
    mimeType,
    format,
    fileSize,
    hasExif: exif.hasExif,
    fields: exif.fields,
  };
}

/**
 * Parses JPEG APP1 segment for authentic EXIF metadata.
 */
function extractJpegExif(buf) {
  try {
    let offset = 2;
    while (offset < buf.length - 4) {
      if (buf[offset] !== 0xFF) {
        offset++;
        continue;
      }

      const marker = buf[offset + 1];

      // SOS (Start of Scan) - image data begins, stop scanning headers
      if (marker === 0xDA || marker === 0xD9) break;

      const length = buf.readUInt16BE(offset + 2);

      // APP1 marker (0xE1)
      if (marker === 0xE1) {
        const header = buf.toString('ascii', offset + 4, offset + 10);
        if (header.startsWith('Exif')) {
          const tiffStart = offset + 10;
          return parseTiffHeader(buf, tiffStart);
        }
      }

      offset += 2 + length;
    }
  } catch {
    // Malformed segment, treat as no EXIF
  }

  return { hasExif: false, fields: {} };
}

function parseTiffHeader(buf, start) {
  try {
    const isLittleEndian = buf.toString('ascii', start, start + 2) === 'II';
    const read16 = (pos) => isLittleEndian ? buf.readUInt16LE(pos) : buf.readUInt16BE(pos);
    const read32 = (pos) => isLittleEndian ? buf.readUInt32LE(pos) : buf.readUInt32BE(pos);

    const firstIFD = read32(start + 4);
    if (firstIFD < 8 || firstIFD > 1000) return { hasExif: false, fields: {} };

    const ifdOffset = start + firstIFD;
    const numEntries = read16(ifdOffset);
    const fields = {};

    const tagNames = {
      0x010F: 'Make',
      0x0110: 'Model',
      0x0131: 'Software',
      0x0132: 'DateTime',
      0x829A: 'ExposureTime',
      0x829D: 'FNumber',
      0x8827: 'ISOSpeedRatings',
    };

    for (let i = 0; i < Math.min(numEntries, 30); i++) {
      const entryPos = ifdOffset + 2 + (i * 12);
      if (entryPos + 12 > buf.length) break;

      const tag = read16(entryPos);
      const type = read16(entryPos + 2);
      const count = read32(entryPos + 4);

      if (tagNames[tag]) {
        if (type === 2) { // ASCII string
          const valOffset = count > 4 ? start + read32(entryPos + 8) : entryPos + 8;
          if (valOffset + count <= buf.length) {
            const str = buf.toString('utf8', valOffset, valOffset + count).replace(/\0+$/, '').trim();
            if (str) fields[tagNames[tag]] = str;
          }
        }
      }
    }

    return {
      hasExif: Object.keys(fields).length > 0,
      fields,
    };
  } catch {
    return { hasExif: false, fields: {} };
  }
}

/**
 * Computes empirical pixel-level statistics from an RGBA pixel array.
 * @param {Uint8ClampedArray|Buffer} rgba - 4 bytes per pixel (R, G, B, A)
 * @param {number} width
 * @param {number} height
 */
export function computeImageSignals(rgba, width, height) {
  const pixelCount = width * height;
  if (!rgba || rgba.length < pixelCount * 4 || pixelCount === 0) {
    return null;
  }

  // 1. Channel Statistics & Luminance
  let sumR = 0, sumG = 0, sumB = 0, sumY = 0;
  const luminance = new Float32Array(pixelCount);
  const histY = new Int32Array(256);

  for (let i = 0; i < pixelCount; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    sumR += r;
    sumG += g;
    sumB += b;

    // Rec. 709 luminance
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luminance[i] = y;
    sumY += y;

    const bin = Math.min(255, Math.max(0, Math.round(y)));
    histY[bin]++;
  }

  const meanR = sumR / pixelCount;
  const meanG = sumG / pixelCount;
  const meanB = sumB / pixelCount;
  const meanY = sumY / pixelCount;

  let varR = 0, varG = 0, varB = 0, varY = 0;
  for (let i = 0; i < pixelCount; i++) {
    varR += (rgba[i * 4] - meanR) ** 2;
    varG += (rgba[i * 4 + 1] - meanG) ** 2;
    varB += (rgba[i * 4 + 2] - meanB) ** 2;
    varY += (luminance[i] - meanY) ** 2;
  }

  const stdDevR = Math.sqrt(varR / pixelCount);
  const stdDevG = Math.sqrt(varG / pixelCount);
  const stdDevB = Math.sqrt(varB / pixelCount);
  const stdDevY = Math.sqrt(varY / pixelCount);

  // 2. Shannon Entropy (in bits per pixel)
  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (histY[i] > 0) {
      const p = histY[i] / pixelCount;
      entropy -= p * Math.log2(p);
    }
  }

  // 3. High-Frequency Residual Noise (Laplacian kernel) & Quadrant Variance
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);
  const quadResiduals = [[], [], [], []]; // TL, TR, BL, BR
  let totalResidualSum = 0;
  let totalResidualSq = 0;
  let validCount = 0;

  for (let y = 1; y < height - 1; y++) {
    const isBottom = y >= halfH;
    for (let x = 1; x < width - 1; x++) {
      const isRight = x >= halfW;
      const quadIdx = (isBottom ? 2 : 0) + (isRight ? 1 : 0);

      const center = luminance[y * width + x];
      const top = luminance[(y - 1) * width + x];
      const bottom = luminance[(y + 1) * width + x];
      const left = luminance[y * width + (x - 1)];
      const right = luminance[y * width + (x + 1)];

      // 2D discrete Laplacian filter
      const res = Math.abs(top + bottom + left + right - 4 * center);
      quadResiduals[quadIdx].push(res);
      totalResidualSum += res;
      totalResidualSq += res * res;
      validCount++;
    }
  }

  const meanResidual = totalResidualSum / (validCount || 1);
  const residualStdDev = Math.sqrt((totalResidualSq / (validCount || 1)) - (meanResidual ** 2));

  // Compute quadrant variances
  const quadVars = quadResiduals.map((arr) => {
    if (arr.length === 0) return 1;
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    const v = arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
    return Math.sqrt(v);
  });

  const maxQuad = Math.max(...quadVars, 0.001);
  const minQuad = Math.max(0.001, Math.min(...quadVars));
  const quadrantVarianceRatio = Number((maxQuad / minQuad).toFixed(2));

  // 4. Edge Gradients (Sobel filter magnitude)
  let edgeSum = 0;
  let highEdgeCount = 0;
  const edgeThreshold = 35; // Luminance gradient threshold

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const tl = luminance[(y - 1) * width + (x - 1)];
      const tc = luminance[(y - 1) * width + x];
      const tr = luminance[(y - 1) * width + (x + 1)];
      const ml = luminance[y * width + (x - 1)];
      const mr = luminance[y * width + (x + 1)];
      const bl = luminance[(y + 1) * width + (x - 1)];
      const bc = luminance[(y + 1) * width + x];
      const br = luminance[(y + 1) * width + (x + 1)];

      const gx = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
      const gy = (bl + 2 * bc + br) - (tl + 2 * tc + tr);
      const mag = Math.sqrt(gx * gx + gy * gy);

      edgeSum += mag;
      if (mag > edgeThreshold) highEdgeCount++;
    }
  }

  const meanGradient = Number((edgeSum / (validCount || 1)).toFixed(2));
  const edgeDensity = Number((highEdgeCount / (validCount || 1)).toFixed(4));
  const sharpnessScore = Number(Math.min(100, (meanGradient * 2.2)).toFixed(1));

  // 5. Compression / 8x8 Grid Blockiness
  let crossDiffSum = 0, crossDiffCount = 0;
  let withinDiffSum = 0, withinDiffCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - 1; x++) {
      const diff = Math.abs(luminance[y * width + x] - luminance[y * width + (x + 1)]);
      if ((x + 1) % 8 === 0) {
        crossDiffSum += diff;
        crossDiffCount++;
      } else {
        withinDiffSum += diff;
        withinDiffCount++;
      }
    }
  }

  const crossMean = crossDiffCount > 0 ? crossDiffSum / crossDiffCount : 1;
  const withinMean = withinDiffCount > 0 ? withinDiffSum / withinDiffCount : 1;
  const blockinessScore = Number((crossMean / (withinMean || 0.001)).toFixed(2));

  return {
    compression: {
      blockinessScore,
      gridDiscontinuityDetected: blockinessScore > 1.45,
    },
    frequency: {
      spatialFrequencyScore: Number((meanGradient / (stdDevY || 1) * 20).toFixed(1)),
    },
    noise: {
      residualStdDev: Number(residualStdDev.toFixed(2)),
      quadrantVarianceRatio,
      noiseUniformity: quadrantVarianceRatio <= 1.35 ? 'consistent' : quadrantVarianceRatio > 1.85 ? 'anomalous' : 'moderate',
    },
    edges: {
      meanGradient,
      edgeDensity,
      sharpnessScore,
    },
    statistics: {
      luminanceMean: Number(meanY.toFixed(1)),
      luminanceStdDev: Number(stdDevY.toFixed(1)),
      shannonEntropy: Number(entropy.toFixed(2)),
      channelStats: {
        red: { mean: Number(meanR.toFixed(1)), stdDev: Number(stdDevR.toFixed(1)) },
        green: { mean: Number(meanG.toFixed(1)), stdDev: Number(stdDevG.toFixed(1)) },
        blue: { mean: Number(meanB.toFixed(1)), stdDev: Number(stdDevB.toFixed(1)) },
      },
    },
  };
}
