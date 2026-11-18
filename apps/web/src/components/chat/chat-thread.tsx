"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Message } from "@utn/shared";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  companyId: string;
  candidateId: string;
  currentUserId: string;
  title?: string;
}

export function ChatThread({ companyId, candidateId, currentUserId, title }: Props) {
  const supabase = createSupabaseBrowserClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from("messages")
      .select("*")
      .eq("company_id", companyId)
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: true });
    if (loadError) {
      setError(loadError.message);
    } else {
      setMessages((data ?? []) as Message[]);
    }
    setLoading(false);
  }, [supabase, companyId, candidateId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${companyId}:${candidateId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const row = payload.new as Message;
          if (row.candidate_id !== candidateId) return;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, companyId, candidateId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("messages")
      .insert({
        company_id: companyId,
        candidate_id: candidateId,
        sender_id: currentUserId,
        body: trimmed,
      })
      .select("*")
      .single();
    if (insertError) {
      setError(insertError.message);
    } else if (data) {
      setMessages((prev) =>
        prev.some((m) => m.id === (data as Message).id) ? prev : [...prev, data as Message],
      );
      setBody("");
    }
    setSending(false);
  }

  return (
    <Card>
      <CardHeader
        title={title ?? "Direct chat"}
        description="Realtime messaging for unlocked profiles."
      />
      <div className="mt-4 flex h-80 flex-col">
        <div className="flex-1 space-y-2 overflow-y-auto rounded-xl border border-line bg-surface-canvas p-3">
          {loading ? (
            <p className="text-sm text-ink-muted">Loading messages…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-ink-muted">No messages yet. Say hello.</p>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === currentUserId;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      mine
                        ? "bg-brand-navy text-white"
                        : "bg-surface-card text-ink-primary ring-1 ring-line"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`mt-1 text-[10px] ${mine ? "text-white/60" : "text-ink-muted"}`}>
                      {new Date(m.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
        <div className="mt-3 flex items-end gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="Write a message…"
            className="flex-1"
          />
          <Button onClick={() => void send()} loading={sending} className="gap-2">
            <Send className="size-4" aria-hidden />
            Send
          </Button>
        </div>
      </div>
    </Card>
  );
}
