import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Upload, CheckCircle2, AlertTriangle, Clock, ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/app/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();

  const { data: docs } = useQuery({
    queryKey: ["dashboard-docs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, original_name, status, size, created_at, extension")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Realtime invalidation
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("dashboard-docs")
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, () => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-docs"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const stats = {
    total: docs?.length ?? 0,
    processing: docs?.filter(d => d.status === "processing" || d.status === "queued").length ?? 0,
    completed: docs?.filter(d => d.status === "completed" || d.status === "finalized").length ?? 0,
    failed: docs?.filter(d => d.status === "failed").length ?? 0,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your document processing activity at a glance.</p>
        </div>
        <Button asChild className="bg-gradient-brand shadow-glow">
          <Link to="/app/upload"><Upload className="mr-2 h-4 w-4" />Upload documents</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FileText} label="Total documents" value={stats.total} tone="primary" />
        <StatCard icon={Clock} label="In progress" value={stats.processing} tone="warning" />
        <StatCard icon={CheckCircle2} label="Completed" value={stats.completed} tone="success" />
        <StatCard icon={AlertTriangle} label="Failed" value={stats.failed} tone="destructive" />
      </div>

      <Card className="overflow-hidden border-border">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Recent documents</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/documents">View all <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
          </Button>
        </div>
        {docs && docs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-border">
            {docs?.slice(0, 8).map((d) => (
              <Link
                key={d.id}
                to="/app/documents/$id"
                params={{ id: d.id }}
                className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-accent/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.original_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(d.size / 1024).toFixed(1)} KB · {d.extension?.toUpperCase()}
                    </p>
                  </div>
                </div>
                <StatusBadge status={d.status} />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: {
  icon: typeof FileText; label: string; value: number;
  tone: "primary" | "success" | "warning" | "destructive";
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning-foreground",
    destructive: "bg-destructive/15 text-destructive",
  }[tone];
  return (
    <Card className="border-border p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Upload className="h-6 w-6" />
      </div>
      <h3 className="font-display text-lg font-semibold">No documents yet</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Upload your first PDF, DOCX, TXT or CSV to kick off the async pipeline.
      </p>
      <Button asChild className="mt-5 bg-gradient-brand">
        <Link to="/app/upload">Upload a document</Link>
      </Button>
    </div>
  );
}
