export const MODEL_PATHS = {
  constant: "./models/constant.onnx",
  identity: "./models/identity.onnx",
  regression: "./models/regression.onnx",
} as const;

export type ModelName = keyof typeof MODEL_PATHS;
