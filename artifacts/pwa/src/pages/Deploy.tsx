import { useState, useEffect } from "react";
import { useGithubDeploy, useGetDeployStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Rocket, Loader2, ExternalLink, AlertCircle, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Deploy() {
  const [token, setToken] = useState("");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [target, setTarget] = useState<"github-pages" | "vercel">("github-pages");
  const [vercelWebhookUrl, setVercelWebhookUrl] = useState("");

  const { toast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem("gitpanel_token");
    if (saved) setToken(saved);
  }, []);

  const { data: statusData, isLoading: loadingStatus, refetch } = useGetDeployStatus(
    { token, owner, repo },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: !!token && !!owner && !!repo, refetchInterval: 3000 } as any }
  );

  const deployMutation = useGithubDeploy({
    mutation: {
      onSuccess: (res) => {
        toast({ title: "Deployment Triggered", description: res.message });
        refetch();
      },
      onError: (err) => {
        toast({ title: "Deploy failed", description: err.data?.error ?? err.message, variant: "destructive" });
      }
    }
  });

  const handleDeploy = () => {
    if (!token || !owner || !repo) {
      toast({ title: "Missing details", description: "Token, Owner, and Repo are required", variant: "destructive" });
      return;
    }
    deployMutation.mutate({
      data: {
        token,
        owner,
        repo,
        target,
        vercelWebhookUrl: target === "vercel" ? vercelWebhookUrl : undefined
      }
    });
  };

  const getStatusBadge = (s?: string) => {
    switch (s) {
      case 'success':
        return <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"><Check className="w-3 h-3 mr-1" /> Success</Badge>;
      case 'failure':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      case 'pending':
      case 'in_progress':
        return <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> {s}</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="p-4 space-y-6 max-w-md mx-auto mt-4 pb-20">
      <div className="flex items-center gap-2">
        <Rocket className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold font-mono">Deployments</h1>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="owner">GitHub Owner</Label>
              <Input
                id="owner"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="username"
                className="bg-background min-h-[44px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repo">Repo Name</Label>
              <Input
                id="repo"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="project"
                className="bg-background min-h-[44px]"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Label htmlFor="target">Target Platform</Label>
            <select
              id="target"
              value={target}
              onChange={(e) => setTarget(e.target.value as "github-pages" | "vercel")}
              className="w-full min-h-[44px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="github-pages">GitHub Pages</option>
              <option value="vercel">Vercel</option>
            </select>
          </div>

          {target === "vercel" && (
            <div className="space-y-2">
              <Label htmlFor="webhook">Vercel Deploy Hook URL</Label>
              <Input
                id="webhook"
                value={vercelWebhookUrl}
                onChange={(e) => setVercelWebhookUrl(e.target.value)}
                placeholder="https://api.vercel.com/v1/integrations/deploy/..."
                className="bg-background min-h-[44px]"
              />
            </div>
          )}

          <Button
            className="w-full min-h-[44px] mt-4 font-mono font-bold"
            onClick={handleDeploy}
            disabled={deployMutation.isPending || !token || !owner || !repo}
          >
            {deployMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-4 h-4 mr-2" />}
            Trigger Deploy
          </Button>
        </CardContent>
      </Card>

      {owner && repo && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3 border-b border-border bg-muted/20 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Live Status
            </CardTitle>
            {loadingStatus && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Status</span>
              {getStatusBadge(statusData?.status)}
            </div>

            {statusData?.message && (
              <div className="text-xs text-muted-foreground p-3 bg-background rounded border border-border break-words">
                {statusData.message}
              </div>
            )}

            {statusData?.deployUrl && (
              <a
                href={statusData.deployUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full p-3 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20 font-medium text-sm"
              >
                Visit Deployment <ExternalLink className="w-4 h-4" />
              </a>
            )}

            {!statusData && !loadingStatus && (
              <div className="text-center text-sm text-muted-foreground py-4">
                No recent deployments found.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
