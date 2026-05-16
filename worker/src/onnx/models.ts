export const MODEL_PATHS = {
  constant: "./src/onnx/models/constant.onnx",
  identity: "./src/onnx/models/identity.onnx",
  regression: "./src/onnx/models/regression.onnx",
} as const;

export type ModelName = keyof typeof MODEL_PATHS;
