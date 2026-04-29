import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Save, Lock, RotateCw, Download, Trash2, FileText, CheckCircle2,
  AlertCircle, Clock, Sparkles, FileJson,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { STAGES, stageLabel, retryJob } from "@/lib/processing";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/app/documents/$id")({
  head: () => ({ meta: [{ title: "Document — AsyncDoc" }] }),
  component: DocumentDetailPage,
});

type Extracted = {
  title?: string; category?: string; summary?: string;
  keywords?: string[]; tags?: string[];
  page_count?: number; confidence_score?: number;
  filename?: string; extension?: string; size?: number;
};

function DocumentDetailPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["document-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*, jobs(*), results(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const job = (data?.jobs as { id: string; progress: number; stage: string; logs: unknown[]; error_message: string | null; retry_count: number; started_at: string | null; completed_at: string | null }[] | null)?.[0];
  const result = (data?.results as { id: string; extracted_json: Extracted; finalized: boolean; finalized_at: string | null }[] | null)?.[0];
  const extracted: Extracted = result?.extracted_json ?? {};
  const finalized = result?.finalized ?? false;

  const [form, setForm] = useState<Extracted>({});
  const [tagInput, setTagInput] = useState("");

  useEffect(() => { if (extracted) setForm(extracted); }, [result?.id]); // eslint-disable-line

  // Realtime updates
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`doc-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "documents", filter: `id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["document-detail", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `document_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["document-detail", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "results", filter: `document_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["document-detail", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, user]);

  const save = async () => {
    if (!result) return;
    const { error } = await supabase.from("results")
      .update({ extracted_json: form } as never)
      .eq("id", result.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  };

  const finalize = async () => {
    if (!result) return;
    const { error } = await supabase.from("results")
      .update({ extracted_json: form, finalized: true, finalized_at: new Date().toISOString() } as never)
      .eq("id", result.id);
    if (error) return toast.error(error.message);
    await supabase.from("documents").update({ status: "finalized" } as never).eq("id", id);
    toast.success("Document finalized");
  };

  const handleRetry = async () => {
    if (!job) return;
    await retryJob(job.id, id);
    toast.success("Retry queued");
  };

  const handleDelete = async () => {
    if (!confirm("Delete this document and all data?")) return;
    if (data?.storage_path) await supabase.storage.from("documents").remove([data.storage_path as string]);
    await supabase.from("documents").delete().eq("id", id);
    toast.success("Deleted");
    navigate({ to: "/app/documents" });
  };

  const exportJSON = () => {
    const payload = { document: { id, name: data?.original_name }, extracted: form, finalized, finalized_at: result?.finalized_at };
    download(`${data?.original_name ?? "document"}.json`, JSON.stringify(payload, null, 2), "application/json");
  };
  const exportCSV = () => {
    const row = {
      filename: data?.original_name ?? "",
      title: form.title ?? "",
      category: form.category ?? "",
      summary: form.summary ?? "",
      status: data?.status ?? "",
      keywords: (form.keywords ?? []).join("|"),
      date: data?.created_at ?? "",
    };
    const csv = csvFrom([row]);
    download(`${data?.original_name ?? "document"}.csv`, csv, "text/csv");
  };

  if (isLoading || !data) {
    return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;
  }

  const currentStageIdx = STAGES.indexOf((job?.stage ?? "queued") as typeof STAGES[number]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-10">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/app/documents"><ArrowLeft className="mr-1 h-4 w-4" />Back</Link></Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground shadow-glow">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">{data.original_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{((data.size as number) / 1024).toFixed(1)} KB</span>
              <span>·</span>
              <span className="uppercase">{data.extension as string}</span>
              <span>·</span>
              <span>{new Date(data.created_at as string).toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={data.status as string} />
          {finalized && <Badge className="bg-gradient-gold text-gold-foreground"><Lock className="mr-1 h-3 w-3" />Finalized</Badge>}
        </div>
      </div>

      {/* Job timeline */}
      <Card className="border-border p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Processing pipeline</h2>
          <div className="flex items-center gap-2">
            {job?.stage === "failed" && (
              <Button size="sm" variant="outline" onClick={handleRetry}>
                <RotateCw className="mr-1 h-3.5 w-3.5" />Retry
              </Button>
            )}
            {job?.retry_count ? <Badge variant="outline">Retries: {job.retry_count}</Badge> : null}
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">{stageLabel(job?.stage ?? "queued")}</span>
            <span className="text-muted-foreground">{job?.progress ?? 0}%</span>
          </div>
          <div className="relative">
            <Progress value={job?.progress ?? 0} className="h-2" />
            {(job?.stage !== "completed" && job?.stage !== "failed") && (
              <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                <div className="h-full w-full animate-shimmer" />
              </div>
            )}
          </div>
        </div>

        <ol className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map((s, i) => {
            const done = i < currentStageIdx || job?.stage === "completed";
            const active = i === currentStageIdx && job?.stage !== "completed";
            return (
              <li key={s} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs
                ${done ? "border-success/30 bg-success/10 text-success" :
                  active ? "border-primary/40 bg-primary/10 text-primary" :
                  "border-border text-muted-foreground"}`}>
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> :
                 active ? <Clock className="h-3.5 w-3.5 animate-pulse" /> :
                 <div className="h-3.5 w-3.5 rounded-full border border-current" />}
                <span className="truncate">{stageLabel(s)}</span>
              </li>
            );
          })}
        </ol>

        {job?.error_message && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{job.error_message}</span>
          </div>
        )}
      </Card>

      {/* Editable extracted data */}
      <Card className="border-border p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" />
            <h2 className="font-display text-lg font-semibold">Extracted fields</h2>
          </div>
          {finalized && <span className="text-xs text-muted-foreground">Read-only · finalized {result?.finalized_at && new Date(result.finalized_at).toLocaleDateString()}</span>}
        </div>

        {!result ? (
          <p className="mt-4 text-sm text-muted-foreground">Result will appear here once processing completes.</p>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={form.title ?? ""} disabled={finalized}
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input id="category" value={form.category ?? ""} disabled={finalized}
                onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="summary">Summary</Label>
              <Textarea id="summary" rows={4} value={form.summary ?? ""} disabled={finalized}
                onChange={(e) => setForm({ ...form, summary: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Keywords</Label>
              <div className="flex flex-wrap gap-2">
                {(form.keywords ?? []).map((k, idx) => (
                  <Badge key={idx} variant="secondary" className="cursor-pointer"
                    onClick={() => !finalized && setForm({ ...form, keywords: (form.keywords ?? []).filter((_, i) => i !== idx) })}>
                    {k} {!finalized && "×"}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="tags">Custom tags</Label>
              <div className="flex gap-2">
                <Input id="tags" placeholder="Add tag and press enter" value={tagInput} disabled={finalized}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && tagInput.trim()) {
                      e.preventDefault();
                      setForm({ ...form, tags: [...(form.tags ?? []), tagInput.trim()] });
                      setTagInput("");
                    }
                  }} />
              </div>
              <div className="flex flex-wrap gap-2">
                {(form.tags ?? []).map((t, idx) => (
                  <Badge key={idx} className="bg-gold/20 text-gold-foreground cursor-pointer"
                    onClick={() => !finalized && setForm({ ...form, tags: (form.tags ?? []).filter((_, i) => i !== idx) })}>
                    {t} {!finalized && "×"}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
            <Button onClick={save} disabled={finalized}><Save className="mr-1 h-4 w-4" />Save</Button>
            <Button onClick={finalize} disabled={finalized} className="bg-gradient-gold text-gold-foreground hover:opacity-90">
              <Lock className="mr-1 h-4 w-4" />Finalize
            </Button>
            <Button variant="outline" onClick={exportJSON}><FileJson className="mr-1 h-4 w-4" />Export JSON</Button>
            <Button variant="outline" onClick={exportCSV}><Download className="mr-1 h-4 w-4" />Export CSV</Button>
            <div className="flex-1" />
            <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={handleDelete}>
              <Trash2 className="mr-1 h-4 w-4" />Delete
            </Button>
          </div>
        )}
      </Card>

      {/* Logs */}
      {job?.logs && (job.logs as unknown[]).length > 0 && (
        <Card className="border-border p-5">
          <h3 className="font-display text-base font-semibold">Logs</h3>
          <div className="mt-3 max-h-64 overflow-auto rounded-md bg-muted/40 p-3 font-mono text-xs">
            {(job.logs as { ts: string; level: string; message: string }[]).map((l, i) => (
              <div key={i} className={l.level === "error" ? "text-destructive" : "text-foreground/80"}>
                <span className="text-muted-foreground">{new Date(l.ts).toLocaleTimeString()}</span> · {l.message}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function csvFrom(rows: Record<string, string>[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
