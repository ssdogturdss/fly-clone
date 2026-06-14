import { Link, useLocation } from "wouter";
import { Home, Github, Terminal, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const [location] = useLocation();

  const tabs = [
    { name: "Dashboard", path: "/", icon: Home },
    { name: "GitHub", path: "/github", icon: Github },
    { name: "Logs", path: "/logs", icon: Terminal },
    { name: "Deploy", path: "/deploy", icon: Rocket },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-center h-16 px-2">
        {tabs.map((tab) => {
          const isActive = location === tab.path;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full min-h-[44px] space-y-1 transition-colors duration-200",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}