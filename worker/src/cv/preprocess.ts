import { decode as decodeJpeg } from "jpeg-js";
import { PNG } from "pngjs";
import { cv, ensureCv } from "./index.js";

// Pre-processing tuning knobs (Phase 2 tuning target)
export const PREPROCESS_CONFIG = {
  // Gaussian blur kernel size (odd, >= 3)
  blurKernelSize: 7,
  // CLAHE clip limit — higher = more contrast enhancement
  claheClipLimit: 3.0,
  // CLAHE tile grid size
  claheTileSize: 8,
  // Bilateral filter enabled + params (alternative to Gaussian for edge-preserving blur)
  bilateralFilterEnabled: false,
  bilateralDiameter: 9,
  bilateralSigmaColor: 75,
  bilateralSigmaSpace: 75,
};

export interface PreprocessedImage {
  gray: any;
  blurred: any;
  equalized: any;
  width: number;
  height: number;
}

function mimeType(buf: Uint8Array): string {
  if (buf[0] === 0xFF && buf[1] === 0xD8) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  // RIFF + WEBP = WebP. RIFF alone could be WAV/AVI.
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
  return "image/jpeg";
}

function decodeImage(buf: Uint8Array): { data: Uint8Array; width: number; height: number } {
  const mime = mimeType(buf);

  if (mime === "image/jpeg") {
    const decoded = decodeJpeg(buf, { useTArray: true });
    return { data: new Uint8Array(decoded.data), width: decoded.width, height: decoded.height };
  }

  if (mime === "image/png") {
    const decoded = PNG.sync.read(Buffer.from(buf));
    return {
      data: new Uint8Array(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength),
      width: decoded.width,
      height: decoded.height,
    };
  }

  // Fallback: try JPEG
  const decoded = decodeJpeg(buf, { useTArray: true });
  return { data: new Uint8Array(decoded.data), width: decoded.width, height: decoded.height };
}

export async function preprocess(imageData: ArrayBuffer): Promise<PreprocessedImage> {
  await ensureCv();

  const bytes = new Uint8Array(imageData);
  const { data, width, height } = decodeImage(bytes);

  const imageDataObj = {
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
    width,
    height,
  };

  const src = cv.matFromImageData(imageDataObj);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const equalized = new cv.Mat();

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    const ksize = new cv.Size(PREPROCESS_CONFIG.blurKernelSize, PREPROCESS_CONFIG.blurKernelSize);
    if (PREPROCESS_CONFIG.bilateralFilterEnabled) {
      cv.bilateralFilter(gray, blurred, PREPROCESS_CONFIG.bilateralDiameter,
        PREPROCESS_CONFIG.bilateralSigmaColor, PREPROCESS_CONFIG.bilateralSigmaSpace);
    } else {
      cv.GaussianBlur(gray, blurred, ksize, 0, 0);
    }
    const clahe = new cv.CLAHE(PREPROCESS_CONFIG.claheClipLimit, new cv.Size(PREPROCESS_CONFIG.claheTileSize, PREPROCESS_CONFIG.claheTileSize));
    clahe.apply(blurred, equalized);
    clahe.delete();
    return { gray, blurred, equalized, width, height };
  } catch (e) {
    gray.delete();
    blurred.delete();
    equalized.delete();
    throw e;
  } finally {
    src.delete();
  }
}

export function releasePreprocessed(p: PreprocessedImage): void {
  p.gray?.delete();
  p.blurred?.delete();
  p.equalized?.delete();
}
