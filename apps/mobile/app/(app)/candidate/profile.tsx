import { useFocusEffect, useRouter } from "expo-router";
import { ArrowRight, Save, Sparkles } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  DEGREE_LEVELS,
  INDUSTRIES,
  candidateProfileSchema,
  type CandidateProfile,
  type DegreeLevel,
  type Industry,
} from "@utn/shared";

import { Screen } from "@/components/screen";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { VerificationBadge } from "@/components/verification-badge";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/cn";
import { apiFetch, readApiError } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Linking } from "react-native";

type FormValues = {
  fullName: string;
  headline: string;
  phone: string;
  industry: Industry | "";
  universityName: string;
  degreeLevel: DegreeLevel;
  graduationYear: string;
  experienceYears: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const currentYear = new Date().getFullYear();

export default function CandidateProfileScreen() {
  const router = useRouter();
  const { user, profile: account } = useAuth();

  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [values, setValues] = useState<FormValues>({
    fullName: account?.email ?? "",
    headline: "",
    phone: "",
    industry: "",
    universityName: "",
    degreeLevel: "Bachelor's Degree",
    graduationYear: String(currentYear),
    experienceYears: "0",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("candidate_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      setFormError(error.message);
      setLoading(false);
      return;
    }

    const candidate = (data as CandidateProfile | null) ?? null;
    setProfile(candidate);

    if (candidate) {
      setValues({
        fullName: candidate.full_name,
        headline: candidate.headline ?? "",
        phone: candidate.phone ?? "",
        industry: (candidate.industry as Industry | null) ?? "",
        universityName: candidate.university_name,
        degreeLevel: candidate.degree_level,
        graduationYear: String(candidate.graduation_year),
        experienceYears: String(candidate.experience_years),
      });
    }

    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    if (!user) return;
    setFormError(null);
    setSaved(false);

    const parsed = candidateProfileSchema.safeParse({
      fullName: values.fullName,
      headline: values.headline || undefined,
      industry: values.industry || undefined,
      universityName: values.universityName,
      degreeLevel: values.degreeLevel,
      graduationYear: values.graduationYear,
      experienceYears: values.experienceYears,
      phone: values.phone || undefined,
    });

    if (!parsed.success) {
      const nextErrors: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormValues;
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setPending(true);

    try {
      const { error } = await supabase.from("candidate_profiles").upsert(
        {
          user_id: user.id,
          full_name: parsed.data.fullName,
          headline: parsed.data.headline ?? null,
          industry: parsed.data.industry ?? null,
          university_name: parsed.data.universityName,
          degree_level: parsed.data.degreeLevel,
          graduation_year: parsed.data.graduationYear,
          experience_years: parsed.data.experienceYears,
          phone: parsed.data.phone ?? null,
        },
        { onConflict: "user_id" },
      );

      if (error) {
        setFormError(error.message);
        return;
      }

      setSaved(true);
      await load();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Could not save your profile.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="font-inter-semibold text-[9px] uppercase tracking-[2px] text-accent-indigo">
            Candidate onboarding
          </Text>
          <Text className="mt-2 font-jakarta-extrabold text-2xl tracking-[-0.6px] text-brand-navy">
            Your profile
          </Text>
          <Text className="mt-1 font-inter text-[11px] leading-5 text-ink-muted">
            Employers see this summary before they unlock your full details. It is checked against
            your certificate.
          </Text>
        </View>
        {profile ? <VerificationBadge status={profile.verification_status} /> : null}
      </View>

      <Card className="mt-4">
        <CardHeader
          title={profile ? "Profile details" : "Create your profile"}
          description="Required fields are marked with an asterisk."
        />

        <View className="mt-4 gap-4">
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          {saved ? (
            <Alert tone="success" title="Profile saved">
              Your details are up to date. Continue with verification when you are ready.
            </Alert>
          ) : null}

          <Field label="Full name" error={errors.fullName} required>
            <Input
              value={values.fullName}
              onChangeText={(value) => update("fullName", value)}
              autoComplete="name"
              placeholder="Amara Okafor"
              invalid={Boolean(errors.fullName)}
            />
          </Field>

          <Field
            label="Headline"
            error={errors.headline}
            hint="One line employers see before opening your profile. 140 characters max."
          >
            <Input
              value={values.headline}
              onChangeText={(value) => update("headline", value)}
              placeholder="Graduate software engineer focused on accessible fintech"
              maxLength={140}
              invalid={Boolean(errors.headline)}
            />
          </Field>

          <Field
            label="Phone"
            error={errors.phone}
            hint="Optional. Only shared after an employer unlock."
          >
            <Input
              value={values.phone}
              onChangeText={(value) => update("phone", value)}
              keyboardType="phone-pad"
              autoComplete="tel"
              placeholder="+27 82 123 4567"
              invalid={Boolean(errors.phone)}
            />
          </Field>

          <Field label="University" error={errors.universityName} required>
            <Input
              value={values.universityName}
              onChangeText={(value) => update("universityName", value)}
              placeholder="University of Cape Town"
              invalid={Boolean(errors.universityName)}
            />
          </Field>

          <Field label="Degree" error={errors.degreeLevel} required>
            <View className="flex-row flex-wrap gap-2">
              {DEGREE_LEVELS.map((degree) => {
                const active = values.degreeLevel === degree;
                return (
                  <Pressable
                    key={degree}
                    onPress={() => update("degreeLevel", degree)}
                    className={cn(
                      "rounded-xl border px-3 py-2",
                      active
                        ? "border-accent-indigo bg-accent-indigo-soft"
                        : "border-line bg-white",
                    )}
                  >
                    <Text
                      className={cn(
                        "font-inter-semibold text-[10px]",
                        active ? "text-accent-indigo" : "text-ink-muted",
                      )}
                    >
                      {degree}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label="Graduation year" error={errors.graduationYear} required>
                <Input
                  value={values.graduationYear}
                  onChangeText={(value) => update("graduationYear", value)}
                  keyboardType="number-pad"
                  maxLength={4}
                  invalid={Boolean(errors.graduationYear)}
                />
              </Field>
            </View>
            <View className="flex-1">
              <Field label="Experience (years)" error={errors.experienceYears} required>
                <Input
                  value={values.experienceYears}
                  onChangeText={(value) => update("experienceYears", value)}
                  keyboardType="number-pad"
                  maxLength={2}
                  invalid={Boolean(errors.experienceYears)}
                />
              </Field>
            </View>
          </View>

          <Field label="Industry" error={errors.industry}>
            <View className="flex-row flex-wrap gap-2">
              {INDUSTRIES.map((industry) => {
                const active = values.industry === industry;
                return (
                  <Pressable
                    key={industry}
                    onPress={() => update("industry", active ? "" : industry)}
                    className={cn(
                      "rounded-full border px-3 py-1.5",
                      active
                        ? "border-accent-indigo bg-accent-indigo-soft"
                        : "border-line bg-white",
                    )}
                  >
                    <Text
                      className={cn(
                        "font-inter-medium text-[10px]",
                        active ? "text-accent-indigo" : "text-ink-muted",
                      )}
                    >
                      {industry}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <Button
            label="Save profile"
            loading={pending}
            icon={<Save size={15} color="#FFFFFF" />}
            onPress={() => void handleSave()}
          />
        </View>
      </Card>

      <Card className="mt-4 border-accent-indigo/20 bg-accent-indigo-soft/40">
        <View className="flex-row items-start gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent-indigo-soft">
            <ArrowRight size={18} color="#4F46E5" />
          </View>
          <View className="flex-1">
            <Text className="font-jakarta-bold text-[14px] text-brand-navy">
              Next: verify your degree
            </Text>
            <Text className="mt-1 font-inter text-[11px] leading-5 text-ink-muted">
              Upload a private certificate and record a live 60–120 second pitch. Submit unlocks at
              exactly one minute.
            </Text>
            <Button
              label="Open verification"
              size="sm"
              className="mt-3 self-start"
              onPress={() => router.push("/candidate/verification")}
            />
          </View>
        </View>
      </Card>

      <Card className="mt-4">
        <View className="flex-row items-start gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent-indigo-soft">
            <Sparkles size={18} color="#4F46E5" />
          </View>
          <View className="flex-1">
            <Text className="font-jakarta-bold text-[14px] text-brand-navy">
              Priority Pro
            </Text>
            <Text className="mt-1 font-inter text-[11px] leading-5 text-ink-muted">
              Pin your profile higher in search results and unlock view analytics.
            </Text>
            {upgradeError ? (
              <Text className="mt-2 font-inter text-[10px] text-danger">{upgradeError}</Text>
            ) : null}
            <Button
              label={upgrading ? "Opening…" : "Upgrade"}
              size="sm"
              className="mt-3 self-start"
              disabled={upgrading}
              onPress={async () => {
                setUpgrading(true);
                setUpgradeError(null);
                try {
                  const res = await apiFetch("/api/stripe/checkout", {
                    method: "POST",
                    body: JSON.stringify({ kind: "candidate_pro" }),
                  });
                  if (!res.ok) {
                    setUpgradeError(await readApiError(res));
                    return;
                  }
                  const body = (await res.json()) as { url?: string };
                  if (body.url) await Linking.openURL(body.url);
                } catch (e) {
                  setUpgradeError(e instanceof Error ? e.message : "Checkout failed.");
                } finally {
                  setUpgrading(false);
                }
              }}
            />
          </View>
        </View>
      </Card>

      {loading ? (
        <Text className="mt-3 text-center font-inter text-[10px] text-ink-muted">
          Syncing your profile…
        </Text>
      ) : null}
    </Screen>
  );
}
