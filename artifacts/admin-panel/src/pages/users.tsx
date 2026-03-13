import { useState } from "react";
import { useGetUsers, useUpdateUser, useDeleteUser, useBlockUser, User } from "@workspace/api-client-react";
import { authHeaders } from "@/lib/auth";
import { formatIDR } from "@/lib/format";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Edit2, Trash2, Ban, ShieldCheck, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetUsers({ request: authHeaders() });
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const updateMutation = useUpdateUser({
    request: authHeaders(),
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
        setEditingUser(null);
      }
    }
  });

  const deleteMutation = useDeleteUser({
    request: authHeaders(),
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }) }
  });

  const blockMutation = useBlockUser({
    request: authHeaders(),
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }) }
  });

  const users = data?.users || [];
  const filteredUsers = users.filter(u => 
    u.phone.includes(search) || u.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    updateMutation.mutate({
      id: editingUser.id,
      data: {
        name: editingUser.name,
        balance: editingUser.balance,
        ewalletType: editingUser.ewalletType || undefined,
        ewalletNumber: editingUser.ewalletNumber || undefined,
        ewalletName: editingUser.ewalletName || undefined,
      }
    });
  };

  return (
    <div className="space-y-8 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold text-white mb-2 tracking-tight">Users Directory</h1>
          <p className="text-muted-foreground text-lg">Manage members and their balances.</p>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <input
            type="text"
            placeholder="Search phone or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-slate-300 text-sm font-semibold uppercase tracking-wider">
                <th className="p-5">User</th>
                <th className="p-5">Balance</th>
                <th className="p-5">Package Expiry</th>
                <th className="p-5">Status</th>
                <th className="p-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">Loading users...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">No users found.</td>
                </tr>
              ) : (
                filteredUsers.map((user, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={user.id} 
                    className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                  >
                    <td className="p-5">
                      <div className="font-bold text-white">{user.name}</div>
                      <div className="text-sm text-muted-foreground">{user.phone}</div>
                    </td>
                    <td className="p-5">
                      <div className="font-bold text-accent">{formatIDR(user.balance)}</div>
                      <div className="text-xs text-muted-foreground">Ref: {user.referralCode}</div>
                    </td>
                    <td className="p-5 text-sm text-slate-300">
                      {user.packageExpiry ? format(new Date(user.packageExpiry), 'dd MMM yyyy HH:mm') : 'None'}
                    </td>
                    <td className="p-5">
                      {user.isBlocked ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-bold border border-destructive/20">
                          <Ban className="w-3 h-3" /> Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                          <ShieldCheck className="w-3 h-3" /> Active
                        </span>
                      )}
                    </td>
                    <td className="p-5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setEditingUser(user)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-primary/20 hover:text-primary text-slate-400 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => blockMutation.mutate({ id: user.id, data: { blocked: !user.isBlocked } })}
                          className={`p-2 rounded-lg transition-colors ${user.isBlocked ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : 'bg-warning/10 text-orange-400 hover:bg-orange-500/20 hover:text-orange-300'}`}
                          title={user.isBlocked ? "Unblock" : "Block"}
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            if (window.confirm(`Delete user ${user.name}? This is permanent.`)) {
                              deleteMutation.mutate({ id: user.id });
                            }
                          }}
                          className="p-2 rounded-lg bg-white/5 hover:bg-destructive/20 hover:text-destructive text-slate-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setEditingUser(null)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-card border border-white/10 rounded-3xl p-8 shadow-2xl"
            >
              <button 
                onClick={() => setEditingUser(null)}
                className="absolute top-6 right-6 text-muted-foreground hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h2 className="text-2xl font-bold text-white mb-6">Edit User</h2>
              
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Name</label>
                  <input 
                    type="text" 
                    value={editingUser.name} 
                    onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary" 
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Balance</label>
                  <input 
                    type="number" 
                    value={editingUser.balance} 
                    onChange={e => setEditingUser({...editingUser, balance: Number(e.target.value)})}
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-400 mb-1 block">E-Wallet Type</label>
                    <input 
                      type="text" 
                      value={editingUser.ewalletType || ""} 
                      onChange={e => setEditingUser({...editingUser, ewalletType: e.target.value})}
                      className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary" 
                      placeholder="e.g. DANA"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 mb-1 block">E-Wallet Number</label>
                    <input 
                      type="text" 
                      value={editingUser.ewalletNumber || ""} 
                      onChange={e => setEditingUser({...editingUser, ewalletNumber: e.target.value})}
                      className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary" 
                    />
                  </div>
                </div>
                
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setEditingUser(null)}
                    className="flex-1 py-3 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-bold shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:-translate-y-0.5 transition-transform disabled:opacity-50"
                  >
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
