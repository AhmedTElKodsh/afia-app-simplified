import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

async function testOpenCV() {
  console.log("Testing OpenCV.js initialization...");
  try {
    // Try to require the dist file directly to see if it populates the global cv
    const cvPath = resolve(repoRoot, "worker/node_modules/@techstark/opencv-js/dist/opencv.js");
    console.log(`Loading OpenCV from: ${cvPath}`);

    // @techstark/opencv-js usually exports a function that returns a promise or the cv object
    const cvModule = await import("@techstark/opencv-js");
    const cv = cvModule.default || cvModule;

    if (typeof cv === "function") {
       console.log("cv is a function, awaiting...");
       // Some versions need awaiting if they are emscripten modules
    }

    console.log("cv keys:", Object.keys(cv).slice(0, 10));
    console.log("cv.Mat type:", typeof cv.Mat);

    if (typeof cv.Mat === "function") {
      console.log("✅ OpenCV.js initialized successfully");
      const mat = new cv.Mat();
      console.log("✅ cv.Mat constructed successfully");
      mat.delete();
    } else {
      console.log("❌ cv.Mat is NOT a function");
    }
  } catch (e) {
    console.error("❌ OpenCV.js test failed:", e);
  }
}

testOpenCV();
