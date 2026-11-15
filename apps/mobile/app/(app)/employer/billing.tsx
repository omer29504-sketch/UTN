import { useFocusEffect, useRouter } from "expo-router";
import { CreditCard, ExternalLink } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";

import { Screen } from "@/components/screen";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, readApiError } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { CREDIT_PACKS } from "@utn/shared";

export default function EmployerBillingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [company, setCompany] = useState<{ id: string; company_name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: companyData }, { data: balanceData }] = await Promise.all([
      supabase.from("companies").select("id, company_name").eq("owner_id", user.id).maybeSingle(),
      supabase.rpc("get_my_credit_balance"),
    ]);
    setCompany(companyData as { id: string; company_name: string } | null);
    setBalance(Number(balanceData ?? 0));
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function startCheckout(packId: string) {
    setCheckingOut(packId);
    setError(null);
    try {
      const res = await apiFetch("/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ kind: "credit_pack", packId }),
      });
      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }
      const body = (await res.json()) as { url?: string };
      if (body.url) await Linking.openURL(body.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout.");
    } finally {
      setCheckingOut(null);
    }
  }

  if (loading) {
    return (
      <Screen>
        <Card>
          <Text className="font-inter text-[12px] text-ink-muted">Loading billing…</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="gap-4">
        <View className="rounded-2xl bg-brand-navy p-5">
          <Text className="font-inter-semibold text-[9px] uppercase tracking-[2px] text-indigo-300">
            Billing
          </Text>
          <Text className="mt-2 font-jakarta-extrabold text-2xl text-white">
            {company?.company_name ?? "Your company"}
          </Text>
          <Text className="mt-1 font-inter text-[11px] text-white/55">
            Credit balance: {balance}
          </Text>
        </View>

        {error ? <Alert tone="error">{error}</Alert> : null}

        {CREDIT_PACKS.map((pack) => (
          <Card key={pack.id}>
            <CardHeader
              title={pack.label}
              description={`${pack.credits} unlock credits`}
            />
            <View className="mt-3 flex-row items-center justify-between">
              <Text className="font-jakarta-extrabold text-xl text-brand-navy">
                {pack.credits} credits
              </Text>
              <Button
                label={checkingOut === pack.id ? "Opening…" : "Buy pack"}
                icon={<CreditCard size={14} color="#FFFFFF" />}
                disabled={checkingOut === pack.id}
                onPress={() => void startCheckout(pack.id)}
              />
            </View>
          </Card>
        ))}

        <Card>
          <Text className="font-inter text-[11px] leading-5 text-ink-muted">
            • 2 trial credits granted at company creation.{"\n"}
            • Pitch videos are always free to watch.{"\n"}
            • Unlocks are permanent and never expire.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}
