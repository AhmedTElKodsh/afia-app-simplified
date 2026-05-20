import { useSearchParams } from "react-router-dom";
import { DEFAULT_BOTTLE_SIZE, type BottleSize } from "@afia/shared";
import { CaptureShell } from "./CaptureShell";

const SUPPORTED_SIZE: BottleSize = DEFAULT_BOTTLE_SIZE;

function readProductSize(value: string | null): BottleSize | null {
  if (value === "1.5L" || value === "2.5L") return value;
  return null;
}

export function ScanShell() {
  const [params] = useSearchParams();
  const size = readProductSize(params.get("size"));
  const isSupported = size === SUPPORTED_SIZE;

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-16 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md flex-col justify-center gap-6">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-amber-300">Scan product</p>
          <h1 className="mt-3 text-4xl font-semibold">{size ? `Afia ${size}` : "Unknown bottle size"}</h1>
        </div>

        {!size ? (
          <div className="rounded-lg border border-red-300/40 bg-red-400/10 p-5">
            <p className="text-lg font-medium">Scan a valid Afia QR code</p>
            <p className="mt-2 text-sm text-neutral-200">
              This scan link does not include a supported bottle size. Use a QR code for Afia 1.5L or 2.5L.
            </p>
          </div>
        ) : isSupported ? (
          <CaptureShell />
        ) : (
          <div className="rounded-lg border border-amber-300/40 bg-amber-300/10 p-5">
            <p className="text-lg font-medium">Analysis for this size is pending</p>
            <p className="mt-2 text-sm text-neutral-200">
              This product identity is preserved for later, but the 2.5L scan flow is delayed.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
