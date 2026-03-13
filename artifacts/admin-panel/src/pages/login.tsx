import { useState } from "react";
import { useLocation } from "wouter";
import { useAdminLogin } from "@workspace/api-client-react";
import { setToken } from "@/lib/auth";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, ShieldCheck, Lock } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [phone, setPhone] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const loginMutation = useAdminLogin({
    mutation: {
      onSuccess: (data) => {
        if (data.success && data.token) {
          setToken(data.token);
          setLocation("/");
        } else {
          setErrorMsg("Login failed. Check your number.");
        }
      },
      onError: () => {
        setErrorMsg("Unauthorized. You are not an admin.");
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!phone) return;
    loginMutation.mutate({ data: { phone } });
  };

  return (
    <div className="min-h-screen w-full flex bg-background relative overflow-hidden">
      {/* Left side abstract visual */}
      <div className="hidden lg:flex w-1/2 relative bg-card items-center justify-center border-r border-white/5 overflow-hidden">
        <img 
          src={`${import.meta.env.BASE_URL}images/login-bg.png`} 
          alt="Abstract gradient mesh" 
          className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 to-background/20" />
        
        <div className="relative z-10 max-w-md p-12 glass-card rounded-3xl border border-white/10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent p-[1px] mb-8 shadow-[0_0_30px_rgba(139,92,246,0.3)]">
            <div className="w-full h-full bg-background rounded-[15px] flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-accent" />
            </div>
          </div>
          <h1 className="text-4xl font-display font-bold text-white mb-4">ALTOGEN System</h1>
          <p className="text-lg text-slate-300 font-medium leading-relaxed">
            Manage the intelligent WhatsApp bot ecosystem. Approve transactions, broadcast updates, and monitor AI generations in real-time.
          </p>
        </div>
      </div>

      {/* Right side login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
        <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-6 shadow-[0_0_20px_rgba(139,92,246,0.15)] ring-1 ring-primary/30">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-display font-bold text-white">Admin Access</h2>
            <p className="text-muted-foreground mt-2 font-medium">Enter your authorized phone number</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300 ml-1">Phone Number</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  placeholder="e.g. 085813899649"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-card/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all backdrop-blur-sm"
                  required
                  autoFocus
                />
              </div>
            </div>

            {errorMsg && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium text-center">
                {errorMsg}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full bg-gradient-to-r from-primary to-accent text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:shadow-[0_0_25px_rgba(139,92,246,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
            >
              {loginMutation.isPending ? "Authenticating..." : "Enter Portal"}
              {!loginMutation.isPending && <ArrowRight className="w-5 h-5" />}
            </button>
          </form>
          
          <p className="text-center text-xs text-muted-foreground mt-8">
            Secure panel • Activity is monitored and logged.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
