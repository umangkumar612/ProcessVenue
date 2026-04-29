import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, type DragEvent, type ChangeEvent } from "react";
import { toast } from "sonner";
import { UploadCloud, FileText, X, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { runProcessingPipeline } from "@/lib/processing";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/app/upload")({
  head: () => ({ meta: [{ title: "Upload — AsyncDoc" }] }),
  component: UploadPage,
});

const ACCEPTED = [".pdf", ".docx", ".txt", ".csv"];
const MAX_BYTES = 25 * 1024 * 1024;

type Pending = { id: string; file: File; progress: number; status: "idle" | "uploading" | "done" | "error"; error?: string };

function validate(file: File): string | null {
  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ACCEPTED.includes(ext)) return `Unsupported type: ${ext}`;
  if (file.size > MAX_BYTES) return `File too large (max ${MAX_BYTES / 1024 / 1024} MB)`;
  if (file.size === 0) return "File is empty";
  return null;
}

export default function UploadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState<Pending[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const addFiles = useCallback((list: FileList | File[]) => {
    const next: Pending[] = [];
    for (const file of Array.from(list)) {
      const err = validate(file);
      if (err) { toast.error(`${file.name}: ${err}`); continue; }
      next.push({ id: crypto.randomUUID(), file, progress: 0, status: "idle" });
    }
    if (next.length) setFiles((p) => [...p, ...next]);
  }, []);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };
  const onSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = "";
  };

  const removeFile = (id: string) => setFiles((p) => p.filter((f) => f.id !== id));

  const startUpload = async () => {
    if (!user || files.length === 0) return;
    setUploading(true);
    let succeeded = 0;
    for (const item of files) {
      if (item.status === "done") continue;
      try {
        setFiles((p) => p.map((f) => f.id === item.id ? { ...f, status: "uploading", progress: 10 } : f));

        const ext = (item.file.name.split(".").pop() ?? "").toLowerCase();
        const safeName = `${Date.now()}-${item.file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
        const path = `${user.id}/${safeName}`;

        const { error: upErr } = await supabase.storage.from("documents").upload(path, item.file, {
          contentType: item.file.type || undefined,
          upsert: false,
        });
        if (upErr) throw upErr;

        setFiles((p) => p.map((f) => f.id === item.id ? { ...f, progress: 60 } : f));

        const { data: doc, error: docErr } = await supabase.from("documents").insert({
          user_id: user.id,
          filename: safeName,
          original_name: item.file.name,
          storage_path: path,
          mime_type: item.file.type || null,
          extension: ext,
          size: item.file.size,
          status: "queued",
        } as never).select("id").single();
        if (docErr || !doc) throw docErr ?? new Error("Failed to create document");

        const { data: job, error: jobErr } = await supabase.from("jobs").insert({
          document_id: doc.id,
          user_id: user.id,
          stage: "queued",
          progress: 5,
        } as never).select("id").single();
        if (jobErr || !job) throw jobErr ?? new Error("Failed to create job");

        // Fire-and-forget background pipeline
        void runProcessingPipeline({
          jobId: job.id,
          documentId: doc.id,
          storagePath: path,
          originalName: item.file.name,
          extension: ext,
          mimeType: item.file.type || null,
          size: item.file.size,
          userId: user.id,
        });

        setFiles((p) => p.map((f) => f.id === item.id ? { ...f, progress: 100, status: "done" } : f));
        succeeded++;
      } catch (e) {
        const msg = (e as Error).message ?? "Upload failed";
        setFiles((p) => p.map((f) => f.id === item.id ? { ...f, status: "error", error: msg } : f));
        toast.error(`${item.file.name}: ${msg}`);
      }
    }
    setUploading(false);
    queryClient.invalidateQueries({ queryKey: ["dashboard-docs"] });
    queryClient.invalidateQueries({ queryKey: ["documents-list"] });
    if (succeeded > 0) {
      toast.success(`${succeeded} document${succeeded > 1 ? "s" : ""} queued for processing`);
      setTimeout(() => navigate({ to: "/app/documents" }), 700);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 md:p-10">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Upload documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">Drag and drop PDF, DOCX, TXT or CSV files. Each upload creates an async processing job.</p>
      </div>

      <Card
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative flex flex-col items-center justify-center border-2 border-dashed p-12 text-center transition-all
          ${dragOver ? "border-primary bg-primary/5 shadow-glow" : "border-border bg-muted/30"}`}
      >
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-glow">
          <UploadCloud className="h-7 w-7" />
        </div>
        <p className="font-display text-lg font-semibold">Drop files here, or browse</p>
        <p className="mt-1 text-sm text-muted-foreground">PDF · DOCX · TXT · CSV — up to 25 MB each</p>
        <label className="mt-5 inline-block">
          <input type="file" multiple accept={ACCEPTED.join(",")} className="sr-only" onChange={onSelect} />
          <span className="inline-flex cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent">
            Select files
          </span>
        </label>
      </Card>

      {files.length > 0 && (
        <Card className="border-border">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h3 className="font-medium">Selected ({files.length})</h3>
            <Button onClick={startUpload} disabled={uploading} className="bg-gradient-brand shadow-glow">
              {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {uploading ? "Uploading…" : "Start upload"}
            </Button>
          </div>
          <ul className="divide-y divide-border">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium">{f.file.name}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {(f.file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  {f.status !== "idle" && (
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={f.progress} className="h-1.5 flex-1" />
                      {f.status === "done" && <CheckCircle2 className="h-4 w-4 text-success" />}
                      {f.status === "error" && <span className="text-xs text-destructive">{f.error}</span>}
                    </div>
                  )}
                </div>
                {f.status !== "uploading" && (
                  <Button variant="ghost" size="icon" onClick={() => removeFile(f.id)} aria-label="Remove">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
