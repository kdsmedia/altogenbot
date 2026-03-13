import { useState } from "react";
import { useGetTransactions, useConfirmTransaction } from "@workspace/api-client-react";
import { authHeaders } from "@/lib/auth";
import { formatIDR } from "@/lib/format";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Check, X, Clock, ExternalLink } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  
  const { data, isLoading } = useGetTransactions(
    { status: filterStatus || undefined, type: filterType || undefined },
    { request: authHeaders() }
  );

  const confirmMutation = useConfirmTransaction({
    request: authHeaders(),
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      }
    }
  });

  const transactions = data?.transactions || [];

  const handleConfirm = (id: number, action: 'approve' | 'reject') => {
    if (window.confirm(`Are you sure you want to ${action} this transaction?`)) {
      confirmMutation.mutate({ id, data: { action } });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold border border-amber-500/20 flex items-center gap-1 w-max"><Clock className="w-3 h-3"/> Pending</span>;
      case 'approved': return <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20 flex items-center gap-1 w-max"><Check className="w-3 h-3"/> Approved</span>;
      case 'rejected': return <span className="px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-bold border border-destructive/20 flex items-center gap-1 w-max"><X className="w-3 h-3"/> Rejected</span>;
      default: return <span className="px-3 py-1 rounded-full bg-white/10 text-white text-xs font-bold border border-white/20 w-max">{status}</span>;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      deposit: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      withdraw: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      package: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    };
    const color = colors[type] || "bg-slate-500/10 text-slate-400 border-slate-500/20";
    return <span className={`px-2.5 py-1 rounded-md text-xs font-bold border uppercase tracking-wider ${color}`}>{type}</span>;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold text-white mb-2 tracking-tight">Transactions</h1>
          <p className="text-muted-foreground text-lg">Approve deposits, withdrawals, and package purchases.</p>
        </div>
        
        <div className="flex gap-3">
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-card border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary appearance-none cursor-pointer"
          >
            <option value="">All Types</option>
            <option value="deposit">Deposit</option>
            <option value="withdraw">Withdraw</option>
            <option value="package">Package</option>
          </select>
          
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-card border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary appearance-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-slate-300 text-sm font-semibold uppercase tracking-wider">
                <th className="p-5">Date</th>
                <th className="p-5">User</th>
                <th className="p-5">Type & Amount</th>
                <th className="p-5">Proof</th>
                <th className="p-5">Status</th>
                <th className="p-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">Loading transactions...</td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">No transactions found matching criteria.</td>
                </tr>
              ) : (
                transactions.map((tx, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={tx.id} 
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="p-5 text-sm text-slate-300">
                      {format(new Date(tx.createdAt), 'dd MMM yyyy')}
                      <div className="text-muted-foreground text-xs">{format(new Date(tx.createdAt), 'HH:mm')}</div>
                    </td>
                    <td className="p-5">
                      <div className="font-bold text-white">{tx.userName}</div>
                      <div className="text-sm text-muted-foreground">{tx.userPhone}</div>
                    </td>
                    <td className="p-5">
                      <div className="mb-1">{getTypeBadge(tx.type)}</div>
                      <div className="font-bold text-white">{formatIDR(tx.amount)}</div>
                      {tx.packageDays && <div className="text-xs text-primary">{tx.packageDays} Days</div>}
                    </td>
                    <td className="p-5">
                      {tx.proofUrl ? (
                        <a href={tx.proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-white transition-colors bg-accent/10 px-3 py-1.5 rounded-lg border border-accent/20">
                          View Proof <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">No proof</span>
                      )}
                    </td>
                    <td className="p-5">
                      {getStatusBadge(tx.status)}
                    </td>
                    <td className="p-5 text-right">
                      {tx.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleConfirm(tx.id, 'approve')}
                            disabled={confirmMutation.isPending}
                            className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white hover:shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all"
                            title="Approve"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleConfirm(tx.id, 'reject')}
                            disabled={confirmMutation.isPending}
                            className="p-2.5 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive hover:text-white hover:shadow-[0_0_15px_rgba(220,38,38,0.5)] transition-all"
                            title="Reject"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
