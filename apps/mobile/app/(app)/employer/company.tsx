import { useFocusEffect, useRouter } from "expo-router";
import { Building2, Save } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";

import { Screen } from "@/components/screen";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import type { Company } from "@utn/shared";

export default function CompanyProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error: loadError } = await supabase
      .from("companies")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (loadError) setError(loadError.message);
    else {
      const c = (data as Company | null) ?? null;
      setCompany(c);
      if (c) {
        setName(c.company_name);
        setConsent(c.display_logo_consent);
      }
    }
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function handleSave() {
    if (!user || !name.trim()) {
      setError("Company name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (company) {
        const { error: updateError } = await supabase
          .from("companies")
          .update({ company_name: name.trim(), display_logo_consent: consent })
          .eq("id", company.id);
        if (updateError) throw updateError;
      } else {
        // Derive corporate domain from the signed-in email.
        const domain = user.email?.split("@")[1]?.toLowerCase() ?? "";
        const { error: insertError } = await supabase.from("companies").insert({
          owner_id: user.id,
          company_name: name.trim(),
          corporate_domain: domain,
          display_logo_consent: consent,
        });
        if (insertError) throw insertError;
      }
      setSaved(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save company.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <Card>
          <Text className="font-inter text-[12px] text-ink-muted">Loading company…</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <CardHeader
          title={company ? "Edit company" : "Create company"}
          description="Your corporate email domain is verified automatically."
        />
        {error ? <Alert tone="error">{error}</Alert> : null}
        {saved ? <Alert tone="success">Company saved.</Alert> : null}
        <View className="mt-4 gap-4">
          <Field label="Company name" required>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="Northwind Labs"
            />
          </Field>
          <View className="flex-row items-center justify-between rounded-xl border border-line bg-surface-canvas px-3.5 py-3">
            <View className="flex-1">
              <Text className="font-inter-semibold text-[12px] text-brand-navy">
                Display logo on landing page
              </Text>
              <Text className="font-inter text-[10px] text-ink-muted">
                Controls the public marquee.
              </Text>
            </View>
            <Switch value={consent} onValueChange={setConsent} />
          </View>
          {company ? (
            <View className="rounded-xl border border-line bg-surface-canvas px-3.5 py-3">
              <Text className="font-inter text-[11px] text-ink-muted">
                Domain: {company.corporate_domain} · {company.is_verified ? "Verified" : "Pending"}
              </Text>
            </View>
          ) : null}
          <Button
            label={saving ? "Saving…" : company ? "Save changes" : "Create company"}
            icon={<Save size={15} color="#FFFFFF" />}
            disabled={saving}
            onPress={() => void handleSave()}
          />
        </View>
      </Card>
    </Screen>
  );
}
