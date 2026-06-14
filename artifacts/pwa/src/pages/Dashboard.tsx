import { useGetServerStatus, useStartServer, useStopServer, useRestartServer } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Play, Square, RotateCcw, Github, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Dashboard() {
  const { data: status, isLoading } = useGetServerStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const startServer = useStartServer({
    mutation: {
      onSuccess: () => {
        toast({ title: "Server starting" });
        queryClient.invalidateQueries({ queryKey: ["/api/server/status"] });
      },
      onError: (err) => {
        toast({ title: "Failed to start server", variant: "destructive", description: err.message });
      }
    }
  });

  const stopServer = useStopServer({
    mutation: {
      onSuccess: () => {
        toast({ title: "Server stopping" });
        queryClient.invalidateQueries({ queryKey: ["/api/server/status"] });
      },
      onError: (err) => {
        toast({ title: "Failed to stop server", variant: "destructive", description: err.message });
      }
    }
  });

  const restartServer = useRestartServer({
    mutation: {
      onSuccess: () => {
        toast({ title: "Server restarting" });
        queryClient.invalidateQueries({ queryKey: ["/api/server/status"] });
      },
      onError: (err) => {
        toast({ title: "Failed to restart server", variant: "destructive", description: err.message });
      }
    }
  });

  const isPending = startServer.isPending || stopServer.isPending || restartServer.isPending;

  return (
    <div className="p-4 space-y-6 max-w-md mx-auto mt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-mono tracking-tight">GitPanel</h1>
        {isLoading ? (
          <Badge variant="outline" className="animate-pulse">Loading...</Badge>
        ) : status?.running ? (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
            Running
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/20">
            <span className="w-2 h-2 rounded-full bg-rose-500 mr-2" />
            Stopped
          </Badge>
        )}
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Server Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px] flex flex-col gap-1 h-auto py-2"
              onClick={() => startServer.mutate()}
              disabled={isPending || status?.running}
            >
              {startServer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 text-emerald-500" />}
              <span className="text-[10px]">Start</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px] flex flex-col gap-1 h-auto py-2"
              onClick={() => stopServer.mutate()}
              disabled={isPending || !status?.running}
            >
              {stopServer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4 text-rose-500" />}
              <span className="text-[10px]">Stop</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px] flex flex-col gap-1 h-auto py-2"
              onClick={() => restartServer.mutate()}
              disabled={isPending || !status?.running}
            >
              {restartServer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4 text-amber-500" />}
              <span className="text-[10px]">Restart</span>
            </Button>
          </div>
          {status?.uptime !== null && status?.uptime !== undefined && (
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>Uptime</span>
              <span className="font-mono text-foreground">{Math.floor(status.uptime)}s</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card overflow-hidden">
        <CardHeader className="pb-3 border-b border-border bg-muted/20">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Recent Logs
            </CardTitle>
            <Link href="/logs" className="text-xs text-primary hover:underline">View All</Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="bg-[#0d1117] p-4 h-48 overflow-y-auto font-mono text-[10px] sm:text-xs leading-relaxed text-muted-foreground">
            {isLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-3 bg-muted/50 rounded w-3/4"></div>
                <div className="h-3 bg-muted/50 rounded w-1/2"></div>
                <div className="h-3 bg-muted/50 rounded w-5/6"></div>
              </div>
            ) : status?.recentLogs?.length ? (
              status.recentLogs.map((log, i) => (
                <div key={i} className="break-all whitespace-pre-wrap">{log}</div>
              ))
            ) : (
              <div className="text-muted-foreground/50 italic">No recent logs</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Link href="/github">
        <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors min-h-[56px]">
          <div className="flex items-center gap-3">
            <Github className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium text-sm">GitHub Sync</span>
          </div>
          <span className="text-xs text-muted-foreground">Configure →</span>
        </div>
      </Link>
    </div>
  );
}