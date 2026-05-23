export type SegmentationPrototypeKind = "compact_unet" | "yolo_seg";

export interface SegmentationPrototypeSpec {
  kind: SegmentationPrototypeKind;
  modelName: string;
  inputName: string;
  inputShape: readonly [1, 3, number, number];
  outputNames: readonly string[];
  targetRuntime: "onnxruntime-web";
  maxModelBytes: number;
}

export interface MaskSummary {
  bottleBox: { xMin: number; yMin: number; xMax: number; yMax: number } | null;
  liquidBox: { xMin: number; yMin: number; xMax: number; yMax: number } | null;
  bottleAreaRatio: number;
  liquidAreaRatio: number;
  liquidYRatioInBottle: number | null;
}

export const SEGMENTATION_PROTOTYPES: Record<SegmentationPrototypeKind, SegmentationPrototypeSpec> = {
  compact_unet: {
    kind: "compact_unet",
    modelName: "afia-liquid-compact-unet-256",
    inputName: "image",
    inputShape: [1, 3, 256, 256],
    outputNames: ["bottle_mask", "liquid_mask"],
    targetRuntime: "onnxruntime-web",
    maxModelBytes: 4_000_000,
  },
  yolo_seg: {
    kind: "yolo_seg",
    modelName: "afia-bottle-yolo-seg-nano-320",
    inputName: "images",
    inputShape: [1, 3, 320, 320],
    outputNames: ["detections", "masks"],
    targetRuntime: "onnxruntime-web",
    maxModelBytes: 8_000_000,
  },
};

export function chooseSegmentationPrototype(kind: SegmentationPrototypeKind = "compact_unet"): SegmentationPrototypeSpec {
  return SEGMENTATION_PROTOTYPES[kind];
}

export function summarizeBinaryMasks(args: {
  width: number;
  height: number;
  bottleMask: ArrayLike<number>;
  liquidMask: ArrayLike<number>;
  threshold?: number;
}): MaskSummary {
  const threshold = args.threshold ?? 0.5;
  const bottleBox = boxFromMask(args.bottleMask, args.width, args.height, threshold);
  const liquidBox = boxFromMask(args.liquidMask, args.width, args.height, threshold);
  const imageArea = Math.max(1, args.width * args.height);
  const bottleArea = countMask(args.bottleMask, threshold);
  const liquidArea = countMask(args.liquidMask, threshold);
  return {
    bottleBox,
    liquidBox,
    bottleAreaRatio: round4(bottleArea / imageArea),
    liquidAreaRatio: round4(liquidArea / imageArea),
    liquidYRatioInBottle: bottleBox && liquidBox
      ? round4((liquidBox.yMin - bottleBox.yMin) / Math.max(1, bottleBox.yMax - bottleBox.yMin))
      : null,
  };
}

function boxFromMask(
  mask: ArrayLike<number>,
  width: number,
  height: number,
  threshold: number,
): MaskSummary["bottleBox"] {
  let xMin = width;
  let yMin = height;
  let xMax = -1;
  let yMax = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (Number(mask[y * width + x] ?? 0) < threshold) continue;
      xMin = Math.min(xMin, x);
      yMin = Math.min(yMin, y);
      xMax = Math.max(xMax, x);
      yMax = Math.max(yMax, y);
    }
  }
  return xMax < 0 ? null : { xMin, yMin, xMax, yMax };
}

function countMask(mask: ArrayLike<number>, threshold: number): number {
  let count = 0;
  for (let i = 0; i < mask.length; i += 1) {
    if (Number(mask[i] ?? 0) >= threshold) count += 1;
  }
  return count;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
