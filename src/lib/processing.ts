import { supabase } from "@/integrations/supabase/client";

type Stage =
  | "queued" | "started" | "parsing_started" | "parsing_completed"
  | "extraction_started" | "extraction_completed" | "storing_result"
  | "completed" | "failed";

const STAGE_PROGRESS: Record<Stage, number> = {
  queued: 5,
  started: 10,
  parsing_started: 25,
  parsing_completed: 50,
  extraction_started: 65,
  extraction_completed: 85,
  storing_result: 95,
  completed: 100,
  failed: 100,
};

const STAGE_LABEL: Record<Stage, string> = {
  queued: "Queued",
  started: "Started",
  parsing_started: "Parsing file",
  parsing_completed: "Parsing complete",
  extraction_started: "Extracting fields",
  extraction_completed: "Extraction complete",
  storing_result: "Saving result",
  completed: "Completed",
  failed: "Failed",
};

export const STAGES: Stage[] = [
  "queued","started","parsing_started","parsing_completed",
  "extraction_started","extraction_completed","storing_result","completed",
];

export function stageLabel(s: string) { return STAGE_LABEL[s as Stage] ?? s; }
export function stageProgress(s: string) { return STAGE_PROGRESS[s as Stage] ?? 0; }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function appendLog(jobId: string, message: string, level: "info" | "error" = "info") {
  const { data: job } = await supabase.from("jobs").select("logs").eq("id", jobId).single();
  const logs = Array.isArray(job?.logs) ? (job!.logs as unknown[]) : [];
  const entry = { ts: new Date().toISOString(), level, message };
  await supabase.from("jobs").update({ logs: [...logs, entry] as never }).eq("id", jobId);
}

async function setStage(jobId: string, stage: Stage, extra: Record<string, unknown> = {}) {
  await supabase.from("jobs").update({
    stage,
    progress: STAGE_PROGRESS[stage],
    ...extra,
  } as never).eq("id", jobId);
  await appendLog(jobId, STAGE_LABEL[stage]);
}

function pickCategory(name: string, mime: string | null) {
  const n = name.toLowerCase();
  if (mime?.includes("pdf") || n.endsWith(".pdf")) return "Document";
  if (n.endsWith(".csv")) return "Dataset";
  if (n.endsWith(".docx")) return "Report";
  if (n.endsWith(".txt")) return "Notes";
  return "General";
}

function buildSummary(originalName: string, ext: string, size: number, content: string | null) {
  if (content && content.trim().length > 0) {
    const cleaned = content.replace(/\s+/g, " ").trim();
    return cleaned.slice(0, 280) + (cleaned.length > 280 ? "…" : "");
  }
  return `Auto-generated summary for ${originalName}. File type ${ext.toUpperCase()}, ${(size / 1024).toFixed(1)} KB.`;
}

function extractTitle(originalName: string, content: string | null) {
  if (content) {
    const firstLine = content.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0);
    if (firstLine) return firstLine.slice(0, 120);
  }
  return originalName.replace(/\.[^.]+$/, "");
}

function extractKeywords(content: string | null, originalName: string): string[] {
  const source = (content ?? originalName).toLowerCase();
  const stop = new Set(["the","and","for","with","that","this","from","have","are","was","you","your","but","not"]);
  const counts: Record<string, number> = {};
  for (const w of source.split(/[^a-z0-9]+/)) {
    if (w.length < 4 || stop.has(w)) continue;
    counts[w] = (counts[w] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 6).map(([w]) => w);
}

/**
 * Runs the asynchronous processing pipeline for a job.
 * Stages publish progress directly to the `jobs` table,
 * and Supabase Realtime streams them to the UI live.
 *
 * This intentionally runs as a fire-and-forget Promise from the upload
 * handler — the UI does not await it. Equivalent to a Celery task in the
 * original spec, just running on the same browser tab's network connection.
 */
export async function runProcessingPipeline(opts: {
  jobId: string;
  documentId: string;
  storagePath: string;
  originalName: string;
  extension: string;
  mimeType: string | null;
  size: number;
  userId: string;
}): Promise<void> {
  const { jobId, documentId, storagePath, originalName, extension, mimeType, size, userId } = opts;

  try {
    await setStage(jobId, "started", { started_at: new Date().toISOString() });
    await supabase.from("documents").update({ status: "processing" } as never).eq("id", documentId);
    await sleep(400);

    // PARSE
    await setStage(jobId, "parsing_started");
    let textContent: string | null = null;
    try {
      const { data: blob, error } = await supabase.storage.from("documents").download(storagePath);
      if (error) throw error;
      const isText = mimeType?.startsWith("text/") || ["txt","csv"].includes(extension);
      if (isText && blob) {
        textContent = (await blob.text()).slice(0, 20_000);
      }
    } catch (e) {
      await appendLog(jobId, `Parse warning: ${(e as Error).message}`, "error");
    }
    await sleep(700);
    await setStage(jobId, "parsing_completed");

    // EXTRACT
    await setStage(jobId, "extraction_started");
    await sleep(700);
    const extracted = {
      filename: originalName,
      extension,
      size,
      mime_type: mimeType,
      uploaded_at: new Date().toISOString(),
      title: extractTitle(originalName, textContent),
      category: pickCategory(originalName, mimeType),
      summary: buildSummary(originalName, extension, size, textContent),
      keywords: extractKeywords(textContent, originalName),
      tags: [] as string[],
      page_count: textContent ? Math.max(1, Math.ceil(textContent.length / 2000)) : 1,
      confidence_score: textContent ? 0.92 : 0.7,
    };
    await setStage(jobId, "extraction_completed");

    // STORE
    await setStage(jobId, "storing_result");
    await supabase.from("results").upsert({
      document_id: documentId,
      user_id: userId,
      extracted_json: extracted,
    } as never, { onConflict: "document_id" });
    await sleep(300);

    // DONE
    await setStage(jobId, "completed", { completed_at: new Date().toISOString() });
    await supabase.from("documents").update({ status: "completed" } as never).eq("id", documentId);
    await supabase.from("activity_logs").insert({
      user_id: userId,
      action: "document.processed",
      metadata: { document_id: documentId } as never,
    });
  } catch (err) {
    const message = (err as Error).message ?? "Unknown error";
    await supabase.from("jobs").update({
      stage: "failed",
      progress: 100,
      error_message: message,
      completed_at: new Date().toISOString(),
    } as never).eq("id", jobId);
    await supabase.from("documents").update({ status: "failed" } as never).eq("id", documentId);
    await appendLog(jobId, `Failed: ${message}`, "error");
  }
}

export async function retryJob(jobId: string, documentId: string) {
  const { data: job } = await supabase.from("jobs").select("retry_count, document_id, user_id").eq("id", jobId).single();
  if (!job) return;
  const { data: doc } = await supabase.from("documents")
    .select("storage_path, original_name, extension, mime_type, size, user_id")
    .eq("id", documentId).single();
  if (!doc) return;

  await supabase.from("jobs").update({
    stage: "queued",
    progress: 0,
    error_message: null,
    started_at: null,
    completed_at: null,
    retry_count: (job.retry_count ?? 0) + 1,
    logs: [{ ts: new Date().toISOString(), level: "info", message: `Retry #${(job.retry_count ?? 0) + 1}` }] as never,
  } as never).eq("id", jobId);
  await supabase.from("documents").update({ status: "queued" } as never).eq("id", documentId);

  void runProcessingPipeline({
    jobId,
    documentId,
    storagePath: doc.storage_path,
    originalName: doc.original_name,
    extension: doc.extension ?? "",
    mimeType: doc.mime_type,
    size: doc.size,
    userId: doc.user_id,
  });
}
