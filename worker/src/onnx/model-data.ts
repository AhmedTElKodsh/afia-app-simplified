import constantModel from "./models/constant.onnx";
import identityModel from "./models/identity.onnx";
import regressionModel from "./models/regression.onnx";

const MODEL_DATA: Record<string, ArrayBuffer> = {
  constant: constantModel,
  "constant.onnx": constantModel,
  identity: identityModel,
  "identity.onnx": identityModel,
  regression: regressionModel,
  "regression.onnx": regressionModel,
  "./src/onnx/models/constant.onnx": constantModel,
  "./src/onnx/models/identity.onnx": identityModel,
  "./src/onnx/models/regression.onnx": regressionModel,
  "src/onnx/models/constant.onnx": constantModel,
  "src/onnx/models/identity.onnx": identityModel,
  "src/onnx/models/regression.onnx": regressionModel,
};

export function getBundledOnnxModel(modelPath: string): ArrayBuffer {
  const fileName = modelPath.split(/[\\/]/).pop() ?? modelPath;
  const model = MODEL_DATA[modelPath] ?? MODEL_DATA[fileName] ?? MODEL_DATA[fileName.replace(/\.onnx$/, "")];
  if (!model) throw new Error(`Unknown bundled ONNX model: ${modelPath}`);
  return model;
}
