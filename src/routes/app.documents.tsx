import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, FileText, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { Progress } from "@/components/ui/progress";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/app/documents")({
  head: () => ({ meta: [{ title: "Documents — AsyncDoc" }] }),
  component: DocumentsPage,
});

type Doc = {
  id: string; original_name: string; status: string; size: number;
  created_at: string; extension: string | null;
  jobs: { progress: number; stage: string }[] | null;
};

function DocumentsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const { data, isLoading } = useQuery({
    queryKey: ["documents-list", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, original_name, status, size, created_at, extension, jobs(progress, stage)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Doc[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("documents-list-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, () => {
        queryClient.invalidateQueries({ queryKey: ["documents-list"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => {
        queryClient.invalidateQueries({ queryKey: ["documents-list"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const filtered = useMemo(() => {
    let arr = data ?? [];
    if (search) arr = arr.filter((d) => d.original_name.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter !== "all") arr = arr.filter((d) => d.status === statusFilter);
    arr = [...arr].sort((a, b) => {
      switch (sortBy) {
        case "oldest": return +new Date(a.created_at) - +new Date(b.created_at);
        case "size": return b.size - a.size;
        case "status": return a.status.localeCompare(b.status);
        default: return +new Date(b.created_at) - +new Date(a.created_at);
      }
    });
    return arr;
  }, [data, search, statusFilter, sortBy]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">{filtered.length} of {data?.length ?? 0} documents</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by filename…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="finalized">Finalized</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[160px]"><ArrowUpDown className="mr-1 h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="size">Largest size</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden border-border">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No documents match your filters.</div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((d) => {
              const job = d.jobs?.[0];
              const progress = job?.progress ?? (d.status === "completed" || d.status === "finalized" ? 100 : 0);
              return (
                <li key={d.id}>
                  <Link
                    to="/app/documents/$id"
                    params={{ id: d.id }}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/40"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{d.original_name}</p>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          {d.extension ?? "?"}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{(d.size / 1024).toFixed(1)} KB</span>
                        <span>·</span>
                        <span>{new Date(d.created_at).toLocaleString()}</span>
                      </div>
                      {(d.status === "processing" || d.status === "queued") && (
                        <Progress value={progress} className="mt-2 h-1" />
                      )}
                    </div>
                    <StatusBadge status={d.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
