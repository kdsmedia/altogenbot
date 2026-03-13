import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, CreditCard, Megaphone, LogOut, Bot, Sparkles } from "lucide-react";
import { clearToken, authHeaders } from "@/lib/auth";
import { useGetStats } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Layout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: stats } = useGetStats({ request: authHeaders() });

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/users", icon: Users, label: "Users" },
    { href: "/transactions", icon: CreditCard, label: "Transactions", badge: stats?.pendingTransactions },
    { href: "/announcements", icon: Megaphone, label: "Announcements" },
  ];

  const handleLogout = () => {
    clearToken();
    setLocation("/login");
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden relative">
      {/* Background ambient lights */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/10 blur-[120px]" />
      </div>

      {/* Sidebar */}
      <aside className="w-72 flex-shrink-0 border-r border-white/5 bg-card/30 backdrop-blur-2xl flex flex-col z-10 relative shadow-[4px_0_24px_rgba(0,0,0,0.2)]">
        <div className="p-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent p-[1px]">
            <div className="w-full h-full bg-background rounded-[11px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-foreground leading-none">ALTOGEN</h1>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-1">Admin Panel</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className="block">
                <div
                  className={cn(
                    "flex items-center justify-between px-4 py-3.5 rounded-xl font-medium transition-all duration-300 group cursor-pointer",
                    isActive
                      ? "bg-primary/10 text-primary shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-primary/20"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={cn("w-5 h-5 transition-transform duration-300", isActive ? "scale-110" : "group-hover:scale-110")} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && item.badge > 0 ? (
                    <span className="bg-gradient-to-r from-primary to-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(139,92,246,0.5)]">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3.5 w-full text-left rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors font-medium cursor-pointer border border-transparent hover:border-destructive/20"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout securely</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden hide-scrollbar scroll-smooth relative z-0">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="p-8 md:p-12 max-w-7xl mx-auto"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
