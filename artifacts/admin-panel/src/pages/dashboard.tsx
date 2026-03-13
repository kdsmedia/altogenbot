import { useGetStats, useGetBotStatus } from "@workspace/api-client-react";
import { authHeaders } from "@/lib/auth";
import { formatIDR } from "@/lib/format";
import { Users, Package, Clock, Wallet, CheckSquare, Bot, RefreshCw, Smartphone } from "lucide-react";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetStats({ request: authHeaders() });
  const { data: bot, isLoading: botLoading, refetch: refetchBot } = useGetBotStatus({ request: authHeaders() });

  const statCards = [
    { title: "Total Users", value: stats?.totalUsers || 0, icon: Users, color: "from-blue-500 to-cyan-400" },
    { title: "Total Balance", value: formatIDR(stats?.totalBalance), icon: Wallet, color: "from-primary to-purple-400" },
    { title: "Active Packages", value: stats?.activePackages || 0, icon: Package, color: "from-pink-500 to-rose-400" },
    { title: "Pending Txs", value: stats?.pendingTransactions || 0, icon: Clock, color: "from-amber-500 to-orange-400" },
    { title: "Today Check-ins", value: stats?.todayCheckins || 0, icon: CheckSquare, color: "from-emerald-500 to-teal-400" },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl font-display font-bold text-white mb-2 tracking-tight">Overview</h1>
        <p className="text-muted-foreground text-lg">Real-time metrics for ALTOGEN system.</p>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-card animate-pulse border border-white/5" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {statCards.map((stat, i) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="glass-card rounded-2xl p-6 relative overflow-hidden group hover:border-white/10 transition-colors"
            >
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.color} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity`} />
              <div className="flex items-center gap-4 mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} bg-opacity-10 shadow-inner`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-sm font-medium text-muted-foreground">{stat.title}</h3>
              </div>
              <div className="text-3xl font-display font-bold text-white tracking-tight">
                {stat.value}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* WhatsApp Bot Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="glass-card rounded-3xl p-8 neon-border relative overflow-hidden"
        >
          <div className="flex justify-between items-start mb-8 relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Bot className="w-8 h-8 text-accent" />
                <h2 className="text-2xl font-display font-bold text-white">Bot Connection</h2>
              </div>
              <p className="text-muted-foreground">Manage WhatsApp gateway session</p>
            </div>
            <button 
              onClick={() => refetchBot()}
              disabled={botLoading}
              className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${botLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="relative z-10">
            {botLoading ? (
              <div className="h-48 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : bot?.connected ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4 ring-4 ring-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                  <Smartphone className="w-10 h-10 text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold text-emerald-400 mb-2">Connected Live</h3>
                <p className="text-emerald-500/80 font-medium">Session Active for: {bot.phone || "Unknown Number"}</p>
              </div>
            ) : bot?.qrCode ? (
              <div className="flex flex-col items-center">
                <div className="p-4 bg-white rounded-2xl shadow-xl mb-6">
                  <img src={bot.qrCode} alt="WhatsApp QR Code" className="w-48 h-48" />
                </div>
                <h3 className="text-xl font-bold text-yellow-400 mb-1">Scan to Connect</h3>
                <p className="text-muted-foreground text-center max-w-sm">
                  Open WhatsApp on your phone, tap Menu or Settings and select Linked Devices. Point your phone to this screen.
                </p>
              </div>
            ) : (
              <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-8 text-center">
                <h3 className="text-xl font-bold text-destructive mb-2">Disconnected</h3>
                <p className="text-destructive/80">Bot is offline and no QR code is available. Please check server logs.</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Quick Actions / Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          className="glass-card rounded-3xl p-8 relative"
        >
          <h2 className="text-2xl font-display font-bold text-white mb-6">System Health</h2>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-white/5">
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                <span className="font-medium text-white">Database Status</span>
              </div>
              <span className="text-emerald-400 text-sm font-bold bg-emerald-500/10 px-3 py-1 rounded-full">Operational</span>
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-white/5">
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                <span className="font-medium text-white">API Gateway</span>
              </div>
              <span className="text-emerald-400 text-sm font-bold bg-emerald-500/10 px-3 py-1 rounded-full">Operational</span>
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-white/5">
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_rgba(139,92,246,0.8)]" />
                <span className="font-medium text-white">Video Generator API</span>
              </div>
              <span className="text-primary text-sm font-bold bg-primary/10 px-3 py-1 rounded-full">Ready</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
