import { Link } from "react-router-dom";
import { buildMockQrSvg, buildProductScanUrl, DEFAULT_BOTTLE_SIZE, type BottleSize } from "@afia/shared";

const SIZES: BottleSize[] = [DEFAULT_BOTTLE_SIZE, "2.5L"];

function toRelativeScanUrl(size: BottleSize): string {
  return buildProductScanUrl("", size);
}

export function MockQrPage() {
  const origin = typeof window === "undefined" ? "https://afia.example" : window.location.origin;

  return (
    <main className="min-h-screen bg-stone-50 px-5 py-16 text-neutral-950 dark:bg-neutral-950 dark:text-white">
      <section className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold">Mock QR links</h1>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {SIZES.map((size) => (
            <article key={size} className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm dark:border-white/15 dark:bg-white/8">
              <div
                className="mx-auto h-44 w-44"
                dangerouslySetInnerHTML={{ __html: buildMockQrSvg(origin, size) }}
              />
              <h2 className="mt-5 text-xl font-semibold">Afia {size}</h2>
              {size === DEFAULT_BOTTLE_SIZE ? (
                <Link
                  className="mt-3 inline-flex rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white dark:bg-amber-300 dark:text-neutral-950"
                  to={toRelativeScanUrl(size)}
                >
                  Scan Afia {size}
                </Link>
              ) : (
                <p className="mt-3 rounded-md border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                  Mock QR only. 2.5L scan flow is delayed.
                </p>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
