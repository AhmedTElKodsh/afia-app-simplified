export interface BottleInfo {
  sizeMl: number;
  supported: boolean;
  message?: string;
}

const SUPPORTED_SIZES = new Set([1500]);

export function validateBottle(bottleSizeMl: number): BottleInfo {
  if (SUPPORTED_SIZES.has(bottleSizeMl)) {
    return { sizeMl: bottleSizeMl, supported: true };
  }
  return {
    sizeMl: bottleSizeMl,
    supported: false,
    message: `Unsupported bottle size: ${bottleSizeMl}ml. Only 1.5L (1500ml) bottles are supported in this version.`,
  };
}
