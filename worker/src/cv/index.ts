import cv from "@techstark/opencv-js";

let cvReady = false;

export async function ensureCv(): Promise<void> {
  if (cvReady) return;
  
  if (typeof cv?.Mat !== "function") {
    // @techstark/opencv-js might need a moment to initialize or it might be exported differently
    // In some environments, it needs to be awaited if it's a promise
    const cvAny = cv as any;
    if (typeof cvAny.then === 'function') {
        await cvAny;
    }
  }

  if (typeof cv?.Mat !== "function") {
    throw new Error("OpenCV.js failed to initialize — cv.Mat not constructable");
  }
  cvReady = true;
}

export { cv };
