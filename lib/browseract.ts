// ════════════════════════════════════════════════════════════════════
// BrowserAct REST client — drives published workflows to pull invoice
// PDFs from ad platforms (Facebook / Google).
//
// API (confirmed):
//   Base:  https://api.browseract.com/v2
//   Auth:  Authorization: Bearer <API_KEY>
//   POST /workflow/run-task        { workflow_id, input_parameters, profile_id? } -> { task_id }
//   GET  /workflow/get-task-status ?task_id=...   -> { status }
//   GET  /workflow/get-task        ?task_id=...   -> { output: { string, files[] } }
//
// NOTE: the exact shape of `output.files[]` (url vs base64) is not fully
// documented — the parsing below is defensive and handles both. Confirm
// against a live run during the prototype phase and tighten if needed.
// ════════════════════════════════════════════════════════════════════

const BASE_URL = process.env.BROWSERACT_BASE_URL ?? "https://api.browseract.com/v2";
const FETCH_TIMEOUT_MS = 30_000;

// Polling cadence for an async task run.
const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_ATTEMPTS = 60; // 60 * 5s = 5 min ceiling per task

export interface RunWorkflowParams {
  apiKey: string;
  workflowId: string;
  inputParameters: Record<string, string | number | boolean>;
  /** Persistent logged-in browser profile (the agency session). */
  profileId?: string;
}

export interface BrowserActFile {
  filename: string;
  buffer: Buffer;
}

export interface WorkflowResult {
  taskId: string;
  status: string;
  /** Structured/string output, if any. */
  output: unknown;
  /** Files downloaded by the workflow (PDF invoices live here). */
  files: BrowserActFile[];
}

const SUCCESS_STATES = new Set(["completed", "success", "succeeded", "finished", "done"]);
const FAILURE_STATES = new Set(["failed", "error", "errored", "cancelled", "canceled", "timeout"]);

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function api<T>(
  apiKey: string,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: init.method,
    headers: authHeaders(apiKey),
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`BrowserAct ${path} failed: ${res.status} — ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/** Pull a value from a loosely-typed object by trying several key names. */
function pick<T = unknown>(obj: Record<string, unknown> | undefined, ...keys: string[]): T | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k] as T;
  }
  return undefined;
}

/** Start a workflow run. Returns the task id. */
export async function runWorkflow(p: RunWorkflowParams): Promise<string> {
  const body: Record<string, unknown> = {
    workflow_id: p.workflowId,
    input_parameters: p.inputParameters,
  };
  if (p.profileId) body.profile_id = p.profileId;

  const json = await api<Record<string, unknown>>(p.apiKey, "/workflow/run-task", {
    method: "POST",
    body,
  });

  const taskId = pick<string>(json, "task_id", "taskId", "id") ??
    pick<string>(pick<Record<string, unknown>>(json, "data"), "task_id", "taskId", "id");

  if (!taskId) throw new Error(`BrowserAct run-task: no task_id in response — ${JSON.stringify(json).slice(0, 200)}`);
  return taskId;
}

/** Current status of a task. */
export async function getTaskStatus(apiKey: string, taskId: string): Promise<string> {
  const json = await api<Record<string, unknown>>(
    apiKey,
    `/workflow/get-task-status?task_id=${encodeURIComponent(taskId)}`,
  );
  const status = pick<string>(json, "status") ?? pick<string>(pick<Record<string, unknown>>(json, "data"), "status");
  return (status ?? "unknown").toLowerCase();
}

/** Decode one file entry from get-task output into a Buffer. */
async function resolveFile(apiKey: string, entry: unknown): Promise<BrowserActFile | null> {
  if (!entry) return null;

  // Entry may be a bare URL string, or an object describing the file.
  if (typeof entry === "string") {
    return downloadFile(apiKey, entry, "invoice.pdf");
  }

  const o = entry as Record<string, unknown>;
  const filename = pick<string>(o, "filename", "name", "file_name") ?? "invoice.pdf";

  // 1) base64 / inline content
  const b64 = pick<string>(o, "content", "data", "base64", "file_base64");
  if (typeof b64 === "string" && b64.length > 0) {
    const cleaned = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64; // strip data: URI prefix
    return { filename, buffer: Buffer.from(cleaned, "base64") };
  }

  // 2) URL to fetch
  const url = pick<string>(o, "url", "download_url", "file_url", "href", "link");
  if (typeof url === "string" && url.length > 0) {
    return downloadFile(apiKey, url, filename);
  }

  return null;
}

/** GET a file URL into a Buffer. Tries with auth first, falls back without. */
async function downloadFile(apiKey: string, url: string, filename: string): Promise<BrowserActFile> {
  const attempt = async (withAuth: boolean) => {
    const res = await fetch(url, {
      headers: withAuth ? { Authorization: `Bearer ${apiKey}` } : undefined,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`download ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  };

  let buffer: Buffer;
  try {
    buffer = await attempt(true);
  } catch {
    buffer = await attempt(false); // some CDNs reject the auth header
  }
  return { filename, buffer };
}

/** Fetch the full task result, including downloaded files. */
export async function getTask(apiKey: string, taskId: string): Promise<WorkflowResult> {
  const json = await api<Record<string, unknown>>(
    apiKey,
    `/workflow/get-task?task_id=${encodeURIComponent(taskId)}`,
  );

  const data = (pick<Record<string, unknown>>(json, "data") ?? json) as Record<string, unknown>;
  const status = (pick<string>(data, "status") ?? "unknown").toLowerCase();
  const output = pick<Record<string, unknown>>(data, "output") ?? {};

  const rawFiles = pick<unknown[]>(output, "files") ?? pick<unknown[]>(data, "files") ?? [];
  const files: BrowserActFile[] = [];
  for (const entry of Array.isArray(rawFiles) ? rawFiles : []) {
    const f = await resolveFile(apiKey, entry);
    if (f) files.push(f);
  }

  return {
    taskId,
    status,
    output: pick<unknown>(output, "string") ?? output,
    files,
  };
}

/**
 * Run a workflow and block until it finishes, returning the result.
 * Throws on failure status or timeout.
 */
export async function runAndWait(p: RunWorkflowParams): Promise<WorkflowResult> {
  const taskId = await runWorkflow(p);

  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);
    const status = await getTaskStatus(p.apiKey, taskId);

    if (SUCCESS_STATES.has(status)) {
      return getTask(p.apiKey, taskId);
    }
    if (FAILURE_STATES.has(status)) {
      const result = await getTask(p.apiKey, taskId).catch(() => null);
      throw new Error(`BrowserAct task ${taskId} ${status}${result ? ` — ${JSON.stringify(result.output).slice(0, 200)}` : ""}`);
    }
  }
  throw new Error(`BrowserAct task ${taskId} timed out after ${(POLL_INTERVAL_MS * POLL_MAX_ATTEMPTS) / 1000}s`);
}

/** Convenience: run a workflow and return the first PDF it downloaded. */
export async function runAndGetPdf(p: RunWorkflowParams): Promise<{ file: BrowserActFile; result: WorkflowResult }> {
  const result = await runAndWait(p);
  const pdf = result.files.find(f => f.filename.toLowerCase().endsWith(".pdf")) ?? result.files[0];
  if (!pdf) throw new Error(`BrowserAct task ${result.taskId} finished but returned no files`);
  return { file: pdf, result };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
