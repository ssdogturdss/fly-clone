import { useState, useEffect } from "react";
import { useGithubPush, useListGithubRepos } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Github, ExternalLink, CheckCircle2, FilePlus2, FilePen, GitCommitHorizontal, ArrowUpRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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

interface PushResult {
  repoUrl?: string;
  filesCommitted: number;
  commitSha?: string;
  isNewRepo?: boolean;
  filesAdded?: number;
  filesChanged?: number;
  message: string;
}

function PushSuccessCard({ result }: { result: PushResult }) {
  const { repoUrl, filesCommitted, commitSha, isNewRepo, filesAdded, filesChanged } = result;
  const showDiff = !isNewRepo && (filesAdded !== undefined || filesChanged !== undefined);

  return (
    <div
      className={cn(
        "mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 overflow-hidden",
        "animate-in fade-in slide-in-from-bottom-2 duration-500"
      )}
    >
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 animate-in zoom-in duration-300" />
        <span className="text-sm font-semibold text-emerald-400">
          {isNewRepo ? "Repository created & pushed!" : "Repository updated!"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 px-4 pb-3">
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 text-xs font-mono text-emerald-300">
          <FilePlus2 className="w-3 h-3" />
          {filesCommitted} file{filesCommitted !== 1 ? "s" : ""} pushed
        </span>

        {commitSha && (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 text-xs font-mono text-emerald-300">
            <GitCommitHorizontal className="w-3 h-3" />
            {commitSha}
          </span>
        )}
      </div>

      {showDiff && (
        <div className="flex gap-3 px-4 pb-3">
          {(filesAdded ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-400/80 font-mono">
              <FilePlus2 className="w-3 h-3" />+{filesAdded} added
            </span>
          )}
          {(filesChanged ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-yellow-400/80 font-mono">
              <FilePen className="w-3 h-3" />~{filesChanged} changed
            </span>
          )}
        </div>
      )}

      {repoUrl && (
        <div className="px-4 pb-4">
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center justify-center gap-2 w-full rounded-md px-4 py-2.5 text-sm font-semibold",
              "bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white transition-colors"
            )}
          >
            <Github className="w-4 h-4" />
            Open on GitHub
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
      )}
    </div>
  );
}

export default function GithubSync() {
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [repoName, setRepoName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [generateCi, setGenerateCi] = useState(true);
  const [includePaths, setIncludePaths] = useState("");

  const { toast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem("gitpanel_token");
    if (saved) setToken(saved);
  }, []);

  const handleSaveToken = (val: string) => {
    setToken(val);
    localStorage.setItem("gitpanel_token", val);
  };

  const { data: repos, isLoading: loadingRepos } = useListGithubRepos(
    { token },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: !!token } as any }
  );

  const pushMutation = useGithubPush({
    mutation: {
      onSuccess: (res) => {
        toast({ title: "Push successful!", description: res.message });
      },
      onError: (err) => {
        toast({ title: "Push failed", description: err.data?.error ?? err.message, variant: "destructive" });
      }
    }
  });

  const handlePush = async () => {
    if (!token || !repoName) {
      toast({ title: "Validation Error", description: "Token and Repo Name are required", variant: "destructive" });
      return;
    }
    let files: { path: string; content: string }[] = [];
    try {
      const url = new URL("/api/files", window.location.origin);
      const trimmed = includePaths.trim();
      if (trimmed) url.searchParams.set("include", trimmed);
      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json() as { files: { path: string; content: string }[] };
        files = data.files ?? [];
      }
    } catch {
      // fall back to empty — README + CI will still be generated
    }
    pushMutation.mutate({
      data: {
        token,
        repoName,
        description,
        private: isPrivate,
        generateCi,
        generateReadme: true,
        files,
      }
    });
  };

  return (
    <div className="p-4 space-y-6 max-w-md mx-auto mt-4">
      <div className="flex items-center gap-2">
        <Github className="w-6 h-6" />
        <h1 className="text-xl font-bold font-mono">GitHub Sync</h1>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">Personal Access Token (PAT)</Label>
            <div className="relative">
              <Input
                id="token"
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => handleSaveToken(e.target.value)}
                placeholder="ghp_..."
                className="pr-10 bg-background min-h-[44px]"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Stored locally on your device.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Push Project
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="repoName">Repository Name</Label>
            <Input
              id="repoName"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder="my-awesome-project"
              className="bg-background min-h-[44px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Built with Replit Agent"
              className="bg-background min-h-[44px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="includePaths">Include paths <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="includePaths"
              value={includePaths}
              onChange={(e) => setIncludePaths(e.target.value)}
              placeholder="artifacts/pwa, artifacts/api-server"
              className="bg-background min-h-[44px]"
            />
            <p className="text-[10px] text-muted-foreground">
              Comma-separated dirs or files relative to workspace root. Leave blank to include all project files.
            </p>
          </div>
          <div className="flex items-center justify-between py-2">
            <Label htmlFor="private" className="flex-1 cursor-pointer">Private Repository</Label>
            <Toggle id="private" checked={isPrivate} onCheckedChange={setIsPrivate} />
          </div>
          <div className="flex items-center justify-between py-2">
            <Label htmlFor="ci" className="flex-1 cursor-pointer">Generate CI Scaffold</Label>
            <Toggle id="ci" checked={generateCi} onCheckedChange={setGenerateCi} />
          </div>

          <Button
            className="w-full min-h-[44px] mt-2 font-mono"
            onClick={handlePush}
            disabled={pushMutation.isPending || !token || !repoName}
          >
            {pushMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {pushMutation.isPending ? "Pushing..." : "git push origin main"}
          </Button>

          {pushMutation.data?.repoUrl && (
            <PushSuccessCard result={pushMutation.data} />
          )}
        </CardContent>
      </Card>

      {token && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Your Repositories
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRepos ? (
              <div className="flex justify-center p-4">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : repos?.length ? (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {repos.map((r) => (
                  <div key={r.id} className="flex justify-between items-center text-sm p-2 bg-muted/20 rounded-md border border-border">
                    <span className="truncate font-mono text-xs">{r.name}</span>
                    <a href={r.htmlUrl} target="_blank" rel="noopener noreferrer" className="text-primary p-2">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No repositories found.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
