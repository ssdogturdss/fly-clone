import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import GithubSync from "@/pages/GithubSync";
import Logs from "@/pages/Logs";
import Deploy from "@/pages/Deploy";
import { BottomNav } from "@/components/BottomNav";

const queryClient = new QueryClient();

function Router() {
  return (
    <div className="min-h-[100dvh] w-full flex flex-col pb-16">
      <main className="flex-1 overflow-y-auto">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/github" component={GithubSync} />
          <Route path="/logs" component={Logs} />
          <Route path="/deploy" component={Deploy} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <BottomNav />
    </div>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;