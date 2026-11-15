import { useLocalSearchParams, useRouter } from "expo-router";
import { Send } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Text, TextInput, View } from "react-native";

import { Screen } from "@/components/screen";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import type { Message } from "@utn/shared";

export default function EmployerChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { candidateId } = useLocalSearchParams<{ candidateId: string }>();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState("Candidate");
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (company) setCompanyId((company as { id: string }).id);

      const { data: cand } = await supabase
        .from("candidate_profiles")
        .select("full_name")
        .eq("user_id", candidateId)
        .maybeSingle();
      if (cand) setCandidateName((cand as { full_name: string }).full_name);
    })();
  }, [user, candidateId]);

  const load = useCallback(async () => {
    if (!companyId || !candidateId) return;
    const { data, error: loadError } = await supabase
      .from("messages")
      .select("*")
      .eq("company_id", companyId)
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: true });
    if (loadError) setError(loadError.message);
    else setMessages((data ?? []) as Message[]);
  }, [companyId, candidateId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!companyId || !candidateId) return;
    const channel = supabase
      .channel(`mobile-emp-chat:${companyId}:${candidateId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `company_id=eq.${companyId}` },
        (payload) => {
          const row = payload.new as Message;
          if (row.candidate_id !== candidateId) return;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [companyId, candidateId]);

  async function send() {
    const trimmed = body.trim();
    if (!trimmed || !user || !companyId || !candidateId) return;
    setSending(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("messages")
      .insert({ company_id: companyId, candidate_id: candidateId, sender_id: user.id, body: trimmed })
      .select("*")
      .single();
    if (insertError) setError(insertError.message);
    else if (data) {
      setMessages((prev) => (prev.some((m) => m.id === (data as Message).id) ? prev : [...prev, data as Message]));
      setBody("");
    }
    setSending(false);
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <View className="flex-1 gap-3">
          <Text className="font-jakarta-extrabold text-xl text-brand-navy">{candidateName}</Text>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ gap: 8, paddingVertical: 8 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const mine = item.sender_id === user?.id;
              return (
                <View className={`flex-row ${mine ? "justify-end" : "justify-start"}`}>
                  <View
                    className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                      mine ? "bg-brand-navy" : "bg-white ring-1 ring-line"
                    }`}
                  >
                    <Text className={`font-inter text-[12px] ${mine ? "text-white" : "text-brand-navy"}`}>
                      {item.body}
                    </Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <Text className="font-inter text-[12px] text-ink-muted">No messages yet.</Text>
            }
          />
          <View className="flex-row items-end gap-2">
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Write a message…"
              multiline
              className="min-h-[40px] flex-1 rounded-xl border border-line bg-white px-3 py-2 font-inter text-[12px] text-ink-primary"
            />
            <Button
              label=""
              icon={<Send size={16} color="#FFFFFF" />}
              disabled={sending || !body.trim()}
              onPress={() => void send()}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
