import { useFocusEffect, useRouter } from "expo-router";
import {
  Building2,
  CreditCard,
  Filter,
  Lock,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Unlock,
  Video as VideoIcon,
} from "lucide-react-native";
import { Video, ResizeMode } from "expo-av";
import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";

import { Screen } from "@/components/screen";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, readApiError } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { EmployerCandidateCard } from "@utn/shared";

export default function EmployerCandidatesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<EmployerCandidateCard[]>([]);
  const [balance, setBalance] = useState(0);
  const [company, setCompany] = useState<{ id: string; company_name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState({
    q: "",
    industry: "",
    degreeLevel: "",
    onlyFeatured: false,
  });

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data: companyData } = await supabase
        .from("companies")
        .select("id, company_name")
        .eq("owner_id", user.id)
        .maybeSingle();
      setCompany(companyData as { id: string; company_name: string } | null);
      if (!companyData) {
        setLoading(false);
        return;
      }

      const { data: balanceData } = await supabase.rpc("get_my_credit_balance");
      setBalance(Number(balanceData ?? 0));

      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      // Mobile filters go through the web RPC via supabase client directly.
      const { data, error: rpcError } = await supabase.rpc("get_verified_candidates_for_employer", {
        p_search: filters.q || null,
        p_industry: filters.industry || null,
        p_degree_level: filters.degreeLevel || null,
        p_university: null,
        p_graduation_year: null,
        p_max_experience_years: null,
        p_only_featured: filters.onlyFeatured,
        p_limit: 40,
        p_offset: 0,
      });
      if (rpcError) throw rpcError;
      setCandidates((data ?? []) as EmployerCandidateCard[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load candidates.");
    } finally {
      setLoading(false);
    }
  }, [user, filters]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function loadVideo(candidateId: string, key: string) {
    try {
      const res = await apiFetch("/api/storage/presign", {
        method: "POST",
        body: JSON.stringify({ intent: "download", bucket: "pitch-videos", key }),
      });
      if (!res.ok) return;
      const body = (await res.json()) as { url: string };
      setVideoUrls((prev) => ({ ...prev, [candidateId]: body.url }));
    } catch {
      // ignore
    }
  }

  async function handleUnlock(candidateId: string) {
    if (!company) return;
    setUnlocking(candidateId);
    try {
      const res = await apiFetch("/api/employer/unlock", {
        method: "POST",
        body: JSON.stringify({ companyId: company.id, candidateId }),
      });
      const body = (await res.json()) as {
        success?: boolean;
        creditBalance?: number | null;
        message?: string;
      };
      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }
      if (body.success) {
        setBalance(body.creditBalance ?? balance);
        setCandidates((prev) =>
          prev.map((c) => (c.candidate_id === candidateId ? { ...c, is_unlocked: true } : c)),
        );
      } else {
        setError(body.message ?? "Unlock failed.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unlock failed.");
    } finally {
      setUnlocking(null);
    }
  }

  if (loading) {
    return (
      <Screen>
        <Card>
          <Text className="font-inter text-[12px] text-ink-muted">Loading candidates…</Text>
        </Card>
      </Screen>
    );
  }

  if (!company) {
    return (
      <Screen>
        <Card>
          <Text className="font-inter text-[12px] text-ink-muted">
            Create your company profile first.
          </Text>
          <Button
            label="Create company"
            className="mt-3 self-start"
            onPress={() => router.push("/employer/company")}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="font-inter-semibold text-[9px] uppercase tracking-[2px] text-indigo-300">
            Discovery
          </Text>
          <Text className="mt-1 font-jakarta-extrabold text-2xl text-brand-navy">Candidates</Text>
        </View>
        <View className="rounded-xl bg-accent-indigo-soft px-3 py-1.5">
          <Text className="font-inter-semibold text-[11px] text-accent-indigo">
            {balance} credits
          </Text>
        </View>
      </View>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {/* Filters */}
      <Card>
        <View className="gap-2">
          <TextInput
            value={filters.q}
            onChangeText={(v) => setFilters((f) => ({ ...f, q: v }))}
            placeholder="Search headline, university, industry"
            className="min-h-[40px] rounded-xl border border-line bg-white px-3 font-inter text-[12px] text-ink-primary"
          />
          <View className="flex-row gap-2">
            <TextInput
              value={filters.industry}
              onChangeText={(v) => setFilters((f) => ({ ...f, industry: v }))}
              placeholder="Industry"
              className="min-h-[40px] flex-1 rounded-xl border border-line bg-white px-3 font-inter text-[12px] text-ink-primary"
            />
            <TextInput
              value={filters.degreeLevel}
              onChangeText={(v) => setFilters((f) => ({ ...f, degreeLevel: v }))}
              placeholder="Degree"
              className="min-h-[40px] flex-1 rounded-xl border border-line bg-white px-3 font-inter text-[12px] text-ink-primary"
            />
          </View>
          <Button
            label="Apply filters"
            icon={<Filter size={14} color="#FFFFFF" />}
            onPress={() => void load()}
          />
        </View>
      </Card>

      <FlatList
        data={candidates}
        keyExtractor={(item) => item.candidate_id}
        contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
        renderItem={({ item }) => {
          const unlocked = item.is_unlocked;
          const name = unlocked ? (item.full_name ?? item.display_name) : item.display_name;
          const videoUrl = videoUrls[item.candidate_id];
          return (
            <Card>
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <Text className="font-jakarta-bold text-[15px] text-brand-navy">{name}</Text>
                  {item.headline ? (
                    <Text className="font-inter text-[11px] text-ink-muted" numberOfLines={2}>
                      {item.headline}
                    </Text>
                  ) : null}
                </View>
                <View className="flex-row gap-1">
                  {item.is_featured ? (
                    <Badge tone="indigo">
                      <Sparkles size={10} color="#4F46E5" />
                    </Badge>
                  ) : null}
                  <Badge tone={unlocked ? "emerald" : "neutral"}>
                    {unlocked ? "Unlocked" : "Locked"}
                  </Badge>
                </View>
              </View>

              <View className="mt-2 flex-row flex-wrap gap-x-3 gap-y-1">
                <Text className="font-inter text-[10px] text-ink-muted">{item.degree_level}</Text>
                <Text className="font-inter text-[10px] text-ink-muted">
                  {item.university_name}
                </Text>
                <Text className="font-inter text-[10px] text-ink-muted">
                  Grad {item.graduation_year}
                </Text>
                <Text className="font-inter text-[10px] text-ink-muted">
                  {item.experience_years} yrs
                </Text>
              </View>

              {item.video_r2_key ? (
                <View className="mt-3 overflow-hidden rounded-xl border border-line bg-studio-obsidian">
                  {videoUrl ? (
                    <Video
                      source={{ uri: videoUrl }}
                      style={{ width: "100%", aspectRatio: 16 / 9 }}
                      useNativeControls
                      resizeMode={ResizeMode.CONTAIN}
                    />
                  ) : (
                    <Pressable
                      onPress={() => void loadVideo(item.candidate_id, item.video_r2_key!)}
                      className="h-28 items-center justify-center"
                    >
                      <View className="flex-row items-center gap-2">
                        <Play size={18} color="#FFFFFF" />
                        <Text className="font-inter-semibold text-[12px] text-white">
                          Watch pitch
                        </Text>
                      </View>
                    </Pressable>
                  )}
                </View>
              ) : null}

              {unlocked ? (
                <View className="mt-3 gap-1 rounded-xl border border-verified-emerald/30 bg-verified-emerald/5 p-3">
                  <Text className="font-inter-semibold text-[12px] text-brand-navy">
                    {item.full_name}
                  </Text>
                  {item.email ? (
                    <Text className="font-inter text-[11px] text-accent-indigo">{item.email}</Text>
                  ) : null}
                  {item.phone ? (
                    <Text className="font-inter text-[11px] text-ink-muted">{item.phone}</Text>
                  ) : null}
                  {item.certificate_r2_key ? (
                    <Button
                      label="View secure certificate"
                      size="sm"
                      className="mt-2 self-start"
                      icon={<ShieldCheck size={13} color="#FFFFFF" />}
                      onPress={() => router.push(`/employer/certificates/${item.candidate_id}`)}
                    />
                  ) : null}
                </View>
              ) : (
                <View className="mt-3">
                  <Button
                    label={unlocking === item.candidate_id ? "Unlocking…" : "Unlock (1 credit)"}
                    icon={<Unlock size={14} color="#FFFFFF" />}
                    disabled={unlocking === item.candidate_id}
                    onPress={() => void handleUnlock(item.candidate_id)}
                  />
                </View>
              )}
            </Card>
          );
        }}
        ListEmptyComponent={
          <Card>
            <Text className="font-inter text-[12px] text-ink-muted">
              No verified candidates match these filters.
            </Text>
          </Card>
        }
      />
    </Screen>
  );
}
