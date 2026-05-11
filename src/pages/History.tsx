import { Clock, Loader2, User } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { useLogs } from "@/lib/hooks/useLogs";

export default function HistoryPage() {
  const { data: logs = [], isLoading } = useLogs();

  return (
    <AppLayout>
      <div className="px-4 md:px-8 lg:px-10 py-6 max-w-3xl mx-auto">
        <h1 className="font-display text-xl md:text-2xl font-bold text-foreground mb-6">Stock History</h1>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : logs.length === 0 ? (
          <div className="glass-card rounded-xl p-10 text-center">
            <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No activity recorded yet.</p>
          </div>
        ) : (
          <div className="glass-card rounded-xl divide-y divide-border">
            {logs.map(l => (
              <div key={l.id} className="px-4 py-3 flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground mt-0.5">
                  <Clock className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="text-sm"><span className="font-semibold text-foreground">{l.stoneName}</span> — <span className="text-muted-foreground">{l.field}</span></p>
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold">
                      <User className="h-3 w-3" />{l.userName}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {l.oldValue ? `${l.oldValue} → ${l.newValue}` : l.newValue}
                    <span className="mx-1">·</span>
                    {new Date(l.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
