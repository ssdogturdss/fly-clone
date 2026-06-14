import { useState, useRef, useEffect } from "react";
import { useGetServerLogs } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Terminal, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function Toggle({ id, checked, onCheckedChange }: { id?: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        checked ? "bg-primary" : "bg-input"
      )}
    >
      <span
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg transition-transform duration-200",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

export default function Logs() {
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: logsData, isLoading, refetch, isFetching } = useGetServerLogs(
    { lines: 100 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { refetchInterval: 2000 } as any }
  );

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logsData?.lines, autoScroll]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 shrink-0 bg-background z-10 border-b border-border">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-bold font-mono">Live Logs</h1>
          {logsData?.total !== undefined && (
            <Badge variant="secondary" className="ml-2 font-mono text-[10px]">
              {logsData.total}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="autoscroll" className="text-xs cursor-pointer">Auto-scroll</Label>
            <Toggle id="autoscroll" checked={autoScroll} onCheckedChange={setAutoScroll} />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            className="min-h-[44px] min-w-[44px]"
            disabled={isFetching}
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto bg-[#0d1117] p-4 pb-20 font-mono text-xs leading-loose"
      >
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col">
            {logsData?.lines?.map((line, i) => (
              <div
                key={`${(logsData.total ?? 0) - (logsData.lines?.length ?? 0) + i}`}
                className="break-all whitespace-pre-wrap py-0.5 border-b border-white/5 text-muted-foreground hover:text-foreground hover:bg-white/5 px-1 rounded-sm transition-colors"
              >
                <span className="text-emerald-500/50 mr-3 select-none">›</span>
                {line}
              </div>
            ))}
            {!logsData?.lines?.length && (
              <div className="text-muted-foreground/50 italic text-center mt-10">
                Log stream is empty
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
