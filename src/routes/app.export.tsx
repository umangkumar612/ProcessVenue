import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/app/export")({
  head: () => ({ meta: [{ title: "Export — AsyncDoc" }] }),
  component: ExportPage,
});

type Row = {
  id: string; original_name: string; status: string; created_at: string;
  results: { extracted_json: Record<string, unknown>; finalized: boolean }[] | null;
};

function ExportPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data } = useQuery({
    queryKey: ["export-rows", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, original_name, status, created_at, results(extracted_json, finalized)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    enabled: !!user,
  });

  const finalizedRows = (data ?? []).filter((r) => r.results?.[0]?.finalized);
  const toggle = (id: string) => {
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const allSelected = finalizedRows.length > 0 && finalizedRows.every((r) => selected.has(r.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(finalizedRows.map((r) => r.id)));
  };

  const exportRows = (rows: Row[], format: "json" | "csv") => {
    if (rows.length === 0) return toast.error("Nothing to export");
    if (format === "json") {
      const payload = rows.map((r) => ({
        id: r.id, name: r.original_name, status: r.status,
        finalized: r.results?.[0]?.finalized, extracted: r.results?.[0]?.extracted_json,
      }));
      download("asyncdoc-export.json", JSON.stringify(payload, null, 2), "application/json");
    } else {
      const records = rows.map((r) => {
        const ex = (r.results?.[0]?.extracted_json ?? {}) as Record<string, unknown>;
        return {
          filename: r.original_name,
          title: String(ex.title ?? ""),
          category: String(ex.category ?? ""),
          summary: String(ex.summary ?? ""),
          status: r.status,
          keywords: Array.isArray(ex.keywords) ? (ex.keywords as string[]).join("|") : "",
          date: r.created_at,
        };
      });
      download("asyncdoc-export.csv", csvFrom(records), "text/csv");
    }
    toast.success(`Exported ${rows.length} record${rows.length > 1 ? "s" : ""}`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-10">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Export center</h1>
        <p className="mt-1 text-sm text-muted-foreground">Download finalized records in JSON or CSV.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ExportCard
          icon={FileJson} title="All finalized — JSON" desc="Complete structured payload"
          onExport={() => exportRows(finalizedRows, "json")}
          count={finalizedRows.length}
        />
        <ExportCard
          icon={FileSpreadsheet} title="All finalized — CSV" desc="Spreadsheet-ready table"
          onExport={() => exportRows(finalizedRows, "csv")}
          count={finalizedRows.length}
        />
      </div>

      <Card className="border-border">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-3">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
            <h2 className="font-medium">Finalized documents ({finalizedRows.length})</h2>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={selected.size === 0}
              onClick={() => exportRows(finalizedRows.filter((r) => selected.has(r.id)), "json")}>
              <FileJson className="mr-1 h-3.5 w-3.5" />Selected JSON
            </Button>
            <Button size="sm" variant="outline" disabled={selected.size === 0}
              onClick={() => exportRows(finalizedRows.filter((r) => selected.has(r.id)), "csv")}>
              <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />Selected CSV
            </Button>
          </div>
        </div>
        {finalizedRows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No finalized documents yet. Finalize one from its detail page to export.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {finalizedRows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                <span className="flex-1 truncate text-sm">{r.original_name}</span>
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ExportCard({ icon: Icon, title, desc, onExport, count }: {
  icon: typeof FileJson; title: string; desc: string; onExport: () => void; count: number;
}) {
  return (
    <Card className="border-border p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{desc} · {count} record{count !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>
      <Button onClick={onExport} className="mt-4 w-full" variant="outline" disabled={count === 0}>
        <Download className="mr-1 h-4 w-4" />Download
      </Button>
    </Card>
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
