import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  queued: "bg-muted text-muted-foreground border-border",
  processing: "bg-warning/15 text-warning-foreground border-warning/30",
  completed: "bg-success/15 text-success border-success/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  finalized: "bg-gradient-gold text-gold-foreground border-transparent",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("capitalize font-medium", variants[status] ?? variants.queued)}>
      {status}
    </Badge>
  );
}
