import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ADMIN_FLAGS,
  CORRECTION_STATUSES,
  DEFAULT_BOTTLE_SIZE,
  type AdminFlag,
  type AnalysisRecord,
  type CorrectionStatus,
} from "@afia/shared";

type Tab = "queue" | "upload" | "dataset";

const ADMIN_TOKEN_KEY = "afia.adminToken";

export function AdminShell() {
  const [tab, setTab] = useState<Tab>("queue");
  const [token, setToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_KEY) ?? "");

  function updateToken(value: string) {
    setToken(value);
    localStorage.setItem(ADMIN_TOKEN_KEY, value);
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-16 text-white">
      <section className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-amber-300">Admin</p>
            <h1 className="mt-3 text-4xl font-semibold">Review Queue</h1>
          </div>
          <label className="grid gap-2 text-sm text-neutral-300">
            Token
            <input
              className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:border-amber-300 sm:w-72"
              value={token}
              onChange={(event) => updateToken(event.currentTarget.value)}
              type="password"
            />
          </label>
        </div>

        <div className="inline-flex w-fit rounded-md border border-white/15 bg-white/8 p-1">
          <button
            className={tabClass(tab === "queue")}
            type="button"
            onClick={() => setTab("queue")}
          >
            Review Queue
          </button>
          <button
            className={tabClass(tab === "upload")}
            type="button"
            onClick={() => setTab("upload")}
          >
            Manual Upload
          </button>
          <button
            className={tabClass(tab === "dataset")}
            type="button"
            onClick={() => setTab("dataset")}
          >
            Dataset Export
          </button>
        </div>

        {tab === "queue" ? <ReviewQueue token={token} /> : null}
        {tab === "upload" ? <ManualUpload token={token} /> : null}
        {tab === "dataset" ? <DatasetExport token={token} /> : null}
      </section>
    </main>
  );
}

function ReviewQueue({ token }: { token: string }) {
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<CorrectionStatus | "all">("pending_review");
  const [message, setMessage] = useState("Loading analyses...");

  async function loadRecords() {
    setMessage("Loading analyses...");
    try {
      const res = await fetch("/api/admin/analyses?limit=100", { headers: adminHeaders(token) });
      if (!res.ok) {
        setRecords([]);
        setMessage(adminFailureMessage(res.status, "load analyses"));
        return;
      }
      const data = await res.json() as { analyses: AnalysisRecord[] };
      setRecords(data.analyses);
      setMessage(data.analyses.length === 0 ? "No analyses found." : "");
    } catch {
      setMessage("Could not load analyses.");
    }
  }

  useEffect(() => {
    void loadRecords();
  }, [token]);

  const visibleRecords = useMemo(
    () => records.filter((record) => statusFilter === "all" || record.correctionStatus === statusFilter),
    [records, statusFilter],
  );

  async function saveCorrection(id: string, patch: CorrectionPatch) {
    const res = await fetch(`/api/admin/analyses/${id}`, {
      method: "PATCH",
      headers: { ...adminHeaders(token), "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(adminFailureMessage(res.status, "save correction"));
    const data = await res.json() as { analysis: AnalysisRecord };
    setRecords((current) => current.map((record) => record.id === id ? data.analysis : record));
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 rounded-md border border-white/15 bg-white/8 p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="grid gap-2 text-sm text-neutral-300">
          Status
          <select
            className="rounded-md border border-white/15 bg-neutral-950 px-3 py-2 text-white"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.currentTarget.value as CorrectionStatus | "all")}
          >
            <option value="all">All</option>
            {CORRECTION_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <button className="rounded-md bg-amber-300 px-4 py-2 font-semibold text-neutral-950" type="button" onClick={loadRecords}>
          Refresh
        </button>
      </div>

      {message ? <p className="rounded-md border border-white/15 bg-white/8 p-4 text-sm text-neutral-300">{message}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {visibleRecords.map((record) => (
          <AnalysisCard key={record.id} record={record} onSave={saveCorrection} />
        ))}
      </div>
    </div>
  );
}

type CorrectionPatch = {
  correctionStatus: CorrectionStatus;
  adminFlag: AdminFlag | null;
  adminCorrectedMl: number | null;
  adminNote: string | null;
};

function AnalysisCard({
  record,
  onSave,
}: {
  record: AnalysisRecord;
  onSave: (id: string, patch: CorrectionPatch) => Promise<void>;
}) {
  const [correctionStatus, setCorrectionStatus] = useState<CorrectionStatus>(record.correctionStatus);
  const [adminFlag, setAdminFlag] = useState<AdminFlag | "">(record.adminFlag ?? "");
  const [adminCorrectedMl, setAdminCorrectedMl] = useState(record.adminCorrectedMl?.toString() ?? "");
  const [adminNote, setAdminNote] = useState(record.adminNote ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await onSave(record.id, {
        correctionStatus,
        adminFlag: adminFlag === "" ? null : adminFlag,
        adminCorrectedMl: adminCorrectedMl === "" ? null : Number(adminCorrectedMl),
        adminNote: adminNote === "" ? null : adminNote,
      });
      setMessage("Correction saved.");
    } catch (error) {
      setMessage(error instanceof Error ? `Could not ${error.message}.` : "Could not save correction.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-md border border-white/15 bg-white/8 p-4">
      <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4">
        <div className="relative h-32 w-24 overflow-hidden rounded-md bg-black">
          <img className="h-full w-full object-contain" src={record.imageUrl} alt={`Analysis ${record.id}`} />
          <div
            aria-label="Detected oil level"
            className="pointer-events-none absolute left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.75)]"
            style={{ top: `${record.redLineYRatio * 100}%` }}
          />
        </div>
        <div>
          <p className="font-semibold">{record.remainingMl} ml remaining</p>
          <p className="mt-1 text-sm text-neutral-300">{record.consumedMl} ml consumed</p>
          <p className="mt-1 text-sm text-neutral-300">{record.provider} · {Math.round(record.confidence * 100)}%</p>
          <p className="mt-2 break-all text-xs text-neutral-500">{record.id}</p>
        </div>
      </div>
      <form className="mt-4 grid gap-3" onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm text-neutral-300">
            Status
            <select className="rounded-md border border-white/15 bg-neutral-950 px-3 py-2 text-white" value={correctionStatus} onChange={(event) => setCorrectionStatus(event.currentTarget.value as CorrectionStatus)}>
              {CORRECTION_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm text-neutral-300">
            Flag
            <select className="rounded-md border border-white/15 bg-neutral-950 px-3 py-2 text-white" value={adminFlag} onChange={(event) => setAdminFlag(event.currentTarget.value as AdminFlag | "")}>
              <option value="">None</option>
              {ADMIN_FLAGS.map((flag) => <option key={flag} value={flag}>{flag}</option>)}
            </select>
          </label>
        </div>
        <label className="grid gap-1 text-sm text-neutral-300">
          Corrected ml
          <input className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white" min={0} max={1500} step={55} value={adminCorrectedMl} onChange={(event) => setAdminCorrectedMl(event.currentTarget.value)} type="number" />
        </label>
        <label className="grid gap-1 text-sm text-neutral-300">
          Note
          <textarea className="min-h-20 rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white" value={adminNote} onChange={(event) => setAdminNote(event.currentTarget.value)} />
        </label>
        <button className="rounded-md bg-amber-300 px-4 py-2 font-semibold text-neutral-950 disabled:bg-neutral-600 disabled:text-neutral-300" disabled={saving} type="submit">
          {saving ? "Saving..." : "Save correction"}
        </button>
        {message ? <p className="text-sm text-neutral-300">{message}</p> : null}
      </form>
    </article>
  );
}

function ManualUpload({ token }: { token: string }) {
  const [imageBase64, setImageBase64] = useState("");
  const [remainingMl, setRemainingMl] = useState("770");
  const [adminNote, setAdminNote] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("Uploading...");
    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { ...adminHeaders(token), "content-type": "application/json" },
        body: JSON.stringify({
          bottleSize: DEFAULT_BOTTLE_SIZE,
          imageBase64,
          remainingMl: Number(remainingMl),
          adminNote: adminNote || null,
        }),
      });
      if (!res.ok) {
        setMessage(adminFailureMessage(res.status, "save manual upload"));
        return;
      }
      setMessage("Manual upload saved.");
      setImageBase64("");
      setAdminNote("");
    } catch {
      setMessage("Manual upload failed.");
    }
  }

  return (
    <form className="grid max-w-2xl gap-4 rounded-md border border-white/15 bg-white/8 p-4" onSubmit={submit}>
      <label className="grid gap-2 text-sm text-neutral-300">
        Bottle image
        <input
          className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white"
          accept="image/*"
          type="file"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void readFileAsDataUrl(file).then(setImageBase64);
          }}
        />
      </label>
      {imageBase64 ? <img className="max-h-72 w-fit rounded-md bg-black object-contain" src={imageBase64} alt="Manual upload preview" /> : null}
      <label className="grid gap-2 text-sm text-neutral-300">
        Ground truth remaining ml
        <input className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white" min={0} max={1500} step={55} value={remainingMl} onChange={(event) => setRemainingMl(event.currentTarget.value)} type="number" />
      </label>
      <label className="grid gap-2 text-sm text-neutral-300">
        Note
        <textarea className="min-h-24 rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white" value={adminNote} onChange={(event) => setAdminNote(event.currentTarget.value)} />
      </label>
      <button className="rounded-md bg-amber-300 px-4 py-3 font-semibold text-neutral-950 disabled:bg-neutral-600 disabled:text-neutral-300" type="submit" disabled={!imageBase64}>
        Save manual upload
      </button>
      {message ? <p className="text-sm text-neutral-300">{message}</p> : null}
    </form>
  );
}

type DatasetExportResponse = {
  datasetVersion: string;
  trustedOnly: boolean;
  rows: Array<{
    id: string;
    imageUrl: string;
    trustedLabel: boolean;
    labelSource: string;
    remainingMl: number | null;
    excludeReason: string | null;
  }>;
};

function DatasetExport({ token }: { token: string }) {
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false);
  const [manifest, setManifest] = useState<DatasetExportResponse | null>(null);
  const [message, setMessage] = useState("");

  async function loadExport() {
    setMessage("Loading dataset export...");
    const suffix = includeDiagnostics ? "?limit=200&includeDiagnostics=true" : "?limit=200";
    try {
      const res = await fetch(`/api/admin/dataset/export${suffix}`, { headers: adminHeaders(token) });
      if (!res.ok) {
        setManifest(null);
        setMessage(adminFailureMessage(res.status, "load dataset export"));
        return;
      }
      const data = await res.json() as DatasetExportResponse;
      setManifest(data);
      setMessage(`${data.rows.length} records ready.`);
    } catch {
      setManifest(null);
      setMessage("Could not load dataset export.");
    }
  }

  return (
    <section className="grid gap-4 rounded-md border border-white/15 bg-white/8 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-3 text-sm text-neutral-300">
          <input
            checked={includeDiagnostics}
            className="h-4 w-4 accent-amber-300"
            type="checkbox"
            onChange={(event) => setIncludeDiagnostics(event.currentTarget.checked)}
          />
          Include diagnostic records
        </label>
        <button className="rounded-md bg-amber-300 px-4 py-2 font-semibold text-neutral-950" type="button" onClick={loadExport}>
          Load export
        </button>
      </div>

      {message ? <p className="text-sm text-neutral-300">{message}</p> : null}
      {manifest ? (
        <div className="grid gap-3">
          <p className="text-sm text-neutral-300">
            Version {manifest.datasetVersion} - {manifest.trustedOnly ? "trusted labels only" : "trusted and diagnostic records"}
          </p>
          <pre className="max-h-96 overflow-auto rounded-md bg-black/40 p-3 text-xs text-neutral-200">
            {JSON.stringify(manifest, null, 2)}
          </pre>
        </div>
      ) : null}
    </section>
  );
}

function tabClass(active: boolean): string {
  return active
    ? "rounded px-4 py-2 text-sm font-semibold bg-amber-300 text-neutral-950"
    : "rounded px-4 py-2 text-sm font-semibold text-neutral-300";
}

function adminHeaders(token: string): HeadersInit {
  return token ? { authorization: `Bearer ${token}` } : {};
}

function adminFailureMessage(status: number, action: string): string {
  if (status === 401) return `${action}: admin token is missing or invalid`;
  if (status === 403) return `${action}: admin token is not authorized`;
  if (status >= 500) return `${action}: server or persistence failure`;
  return `${action}: request failed with ${status}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
