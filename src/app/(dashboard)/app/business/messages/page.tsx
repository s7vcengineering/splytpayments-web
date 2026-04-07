"use client";

import { useEffect, useState, useRef } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { ChatThread, ChatMessage } from "@/lib/types";
import { timeAgo } from "@/lib/types";

export default function CustomerMessagesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);

      // Get threads where user is host (via experiences)
      const { data: exps } = await supabase.from("experiences").select("id").eq("host_id", user.id);
      const expIds = exps?.map((e: any) => e.id) || [];

      if (expIds.length === 0) { setLoading(false); return; }

      const { data } = await supabase
        .from("chat_threads")
        .select("*")
        .in("experience_id", expIds)
        .eq("is_direct_message", false)
        .order("updated_at", { ascending: false });
      if (data) setThreads(data as ChatThread[]);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedThread) return;
    const supabase = createBrowserSupabase();

    supabase
      .from("chat_messages")
      .select("*")
      .eq("thread_id", selectedThread.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => { if (data) setMessages(data as ChatMessage[]); });

    const channel = supabase
      .channel(`biz-msg:${selectedThread.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${selectedThread.id}` },
        (payload) => setMessages((prev) => [...prev, payload.new as ChatMessage]))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedThread]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !selectedThread || !userId) return;
    setSending(true);
    const supabase = createBrowserSupabase();
    const { data: profile } = await supabase.from("profiles").select("display_name,avatar_url").eq("id", userId).single();
    await supabase.from("chat_messages").insert({
      thread_id: selectedThread.id,
      sender_id: userId,
      sender_name: profile?.display_name || "Host",
      sender_avatar_url: profile?.avatar_url,
      content: newMessage.trim(),
    });
    setNewMessage("");
    setSending(false);
  }

  return (
    <div className="flex h-full">
      {/* Thread list */}
      <div className={`w-full sm:w-80 lg:w-96 border-r border-gray-200 bg-white flex flex-col ${selectedThread ? "hidden sm:flex" : "flex"}`}>
        <div className="p-4 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900">Customer Messages</h1>
          <p className="text-xs text-gray-500 mt-0.5">{threads.length} thread{threads.length !== 1 ? "s" : ""} from your experiences</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div>{[1, 2, 3].map((i) => <div key={i} className="flex items-center gap-3 p-4 animate-pulse"><div className="w-11 h-11 rounded-full bg-gray-200" /><div className="flex-1 space-y-2"><div className="h-3.5 bg-gray-200 rounded w-3/4" /><div className="h-3 bg-gray-200 rounded w-1/2" /></div></div>)}</div>
          ) : threads.length === 0 ? (
            <div className="p-8 text-center"><p className="text-sm text-gray-500">No customer messages yet</p></div>
          ) : (
            threads.map((thread) => (
              <button key={thread.id} onClick={() => setSelectedThread(thread)} className={`w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 ${selectedThread?.id === thread.id ? "bg-ocean-50" : ""}`}>
                <div className="w-11 h-11 rounded-full bg-ocean-100 flex items-center justify-center text-ocean-600 font-bold text-sm shrink-0">
                  {thread.experience_title?.[0]?.toUpperCase() || "#"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{thread.experience_title}</p>
                    <span className="text-xs text-gray-400 shrink-0">{timeAgo(thread.updated_at)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{thread.member_ids?.length || 0} members</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Messages */}
      <div className={`flex-1 flex flex-col bg-gray-50 ${!selectedThread ? "hidden sm:flex" : "flex"}`}>
        {!selectedThread ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-gray-500">Select a conversation</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 p-4 bg-white border-b border-gray-200">
              <button onClick={() => setSelectedThread(null)} className="sm:hidden p-1 text-gray-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="w-9 h-9 rounded-full bg-ocean-100 flex items-center justify-center text-ocean-600 font-bold text-sm">
                {selectedThread.experience_title?.[0]?.toUpperCase() || "#"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{selectedThread.experience_title}</p>
                <p className="text-xs text-gray-500">{selectedThread.member_ids?.length || 0} members</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-12">No messages yet</p>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === userId;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`flex items-end gap-2 max-w-[75%] ${isMine ? "flex-row-reverse" : ""}`}>
                        {!isMine && (
                          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                            {msg.sender_avatar_url ? <img src={msg.sender_avatar_url} alt="" className="w-full h-full rounded-full object-cover" /> : msg.sender_name?.[0]?.toUpperCase() || "?"}
                          </div>
                        )}
                        <div>
                          {!isMine && <p className="text-xs text-gray-400 mb-0.5 ml-1">{msg.sender_name || "User"}</p>}
                          <div className={`px-3.5 py-2 rounded-2xl text-sm ${isMine ? "bg-ocean-500 text-white rounded-br-md" : "bg-white text-gray-900 border border-gray-200 rounded-bl-md"}`}>
                            {msg.content}
                          </div>
                          <p className={`text-xs text-gray-400 mt-0.5 ${isMine ? "text-right mr-1" : "ml-1"}`}>{timeAgo(msg.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="p-4 bg-white border-t border-gray-200">
              <div className="flex items-center gap-2">
                <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Reply to customer..." className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500 transition-all" />
                <button type="submit" disabled={sending || !newMessage.trim()} className="p-2.5 bg-ocean-500 text-white rounded-xl hover:bg-ocean-600 transition-colors disabled:opacity-50">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
