import { useFocusEffect, useRouter } from "expo-router";
import { MessageSquare } from "lucide-react-native";
import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

import { Screen } from "@/components/screen";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";

interface UnlockRow {
  company_id: string;
  unlocked_at: string;
  company_name: string | null;
}

export default function CandidateMessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<UnlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data: unlocks, error: unlockError } = await supabase
        .from("company_unlocked_candidates")
        .select("company_id, unlocked_at")
        .eq("candidate_id", user.id);
      if (unlockError) throw unlockError;

      const ids = (unlocks ?? []).map((u: { company_id: string }) => u.company_id);
      let nameMap: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: companies } = await supabase
          .from("companies")
          .select("id, company_name")
          .in("id", ids);
        (companies ?? []).forEach((c: { id: string; company_name: string }) => {
          nameMap[c.id] = c.company_name;
        });
      }

      setRows(
        (unlocks ?? []).map((u: { company_id: string; unlocked_at: string }) => ({
          company_id: u.company_id,
          unlocked_at: u.unlocked_at,
          company_name: nameMap[u.company_id] ?? "Employer",
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load conversations.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) {
    return (
      <Screen>
        <Card>
          <Text className="font-inter text-[12px] text-ink-muted">Loading conversations…</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="gap-4">
        <View>
          <Text className="font-inter-semibold text-[9px] uppercase tracking-[2px] text-indigo-300">
            Messages
          </Text>
          <Text className="mt-1 font-jakarta-extrabold text-2xl text-brand-navy">
            Your conversations
          </Text>
        </View>

        {error ? <Alert tone="error">{error}</Alert> : null}

        {rows.length === 0 ? (
          <Card>
            <Text className="font-inter text-[12px] text-ink-muted">
              No conversations yet. Once an employer unlocks your profile, you can chat here.
            </Text>
          </Card>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.company_id}
            contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => router.push(`/candidate/messages/${item.company_id}`)}>
                <Card>
                  <View className="flex-row items-center gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent-indigo-soft">
                      <MessageSquare size={18} color="#4F46E5" />
                    </View>
                    <View className="flex-1">
                      <Text className="font-inter-semibold text-[13px] text-brand-navy">
                        {item.company_name}
                      </Text>
                      <Text className="font-inter text-[10px] text-ink-muted">
                        Unlocked {new Date(item.unlocked_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                </Card>
              </Pressable>
            )}
          />
        )}
      </View>
    </Screen>
  );
}
