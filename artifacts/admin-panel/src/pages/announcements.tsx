import { useState } from "react";
import { useGetAnnouncements, useCreateAnnouncement, useDeleteAnnouncement } from "@workspace/api-client-react";
import { authHeaders } from "@/lib/auth";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Megaphone, Send, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function AnnouncementsPage() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  
  const { data, isLoading } = useGetAnnouncements({ request: authHeaders() });

  const createMutation = useCreateAnnouncement({
    request: authHeaders(),
    mutation: {
      onSuccess: () => {
        setMessage("");
        queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      }
    }
  });

  const deleteMutation = useDeleteAnnouncement({
    request: authHeaders(),
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] })
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    createMutation.mutate({ data: { message } });
  };

  const announcements = data?.announcements || [];

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-4xl font-display font-bold text-white mb-2 tracking-tight">Announcements</h1>
        <p className="text-muted-foreground text-lg">Broadcast messages to all bot users.</p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-3xl p-6 md:p-8 neon-border relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent" />
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
          <Megaphone className="w-5 h-5 text-primary" />
          New Broadcast
        </h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your announcement here... It will be sent to the global channel or shown in user menus."
            className="w-full h-32 bg-background/50 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
            required
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={createMutation.isPending || !message.trim()}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-bold flex items-center gap-2 hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {createMutation.isPending ? "Broadcasting..." : "Send Announcement"}
            </button>
          </div>
        </form>
      </motion.div>

      <div className="space-y-4">
        <h3 className="text-xl font-bold text-white mb-4">Recent Announcements</h3>
        {isLoading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : announcements.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center text-muted-foreground border-dashed border-white/10">
            No announcements broadcasted yet.
          </div>
        ) : (
          announcements.map((ann, i) => (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              key={ann.id}
              className="bg-card rounded-2xl p-6 border border-white/5 flex gap-4 items-start group hover:border-white/10 transition-colors shadow-lg"
            >
              <div className="p-3 rounded-full bg-primary/10 text-primary shrink-0">
                <Megaphone className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-slate-200 leading-relaxed mb-2 whitespace-pre-wrap">{ann.message}</p>
                <p className="text-xs text-muted-foreground font-medium">
                  {format(new Date(ann.createdAt), 'MMMM do, yyyy • HH:mm')}
                </p>
              </div>
              <button
                onClick={() => {
                  if (window.confirm("Delete this announcement?")) {
                    deleteMutation.mutate({ id: ann.id });
                  }
                }}
                disabled={deleteMutation.isPending}
                className="p-2 rounded-lg text-slate-500 hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all shrink-0"
                title="Delete"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
