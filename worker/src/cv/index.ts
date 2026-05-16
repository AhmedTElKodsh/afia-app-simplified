import cv from "@techstark/opencv-js";

let cvReady = false;

export async function ensureCv(): Promise<void> {
  if (cvReady) return;
  if (typeof cv?.Mat !== "function") {
    throw new Error("OpenCV.js failed to initialize — cv.Mat not constructable");
  }
  cvReady = true;
}

export { cv };
