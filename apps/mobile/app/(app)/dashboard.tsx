import { useFocusEffect, useRouter } from "expo-router";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  CreditCard,
  FileText,
  ScanFace,
  Sparkles,
  Video,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import {
  formatPitchDuration,
  type CandidateMedia,
  type CandidateProfile,
  type Company,
} from "@utn/shared";

import { Screen } from "@/components/screen";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { VerificationBadge } from "@/components/verification-badge";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

interface ReviewRow {
  decision: "verified" | "rejected";
  rejection_reason: string | null;
  created_at: string;
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: typeof BadgeCheck;
  label: string;
  value: string;
  hint: string;
}) {
  const Icon = icon;
  return (
    <Card className="flex-1 p-4">
      <View className="flex-row items-center gap-1.5">
        <Icon size={13} color="#4F46E5" />
        <Text className="font-inter-semibold text-[8px] uppercase tracking-[1.4px] text-ink-muted">
          {label}
        </Text>
      </View>
      <Text className="mt-2 font-jakarta-extrabold text-xl text-brand-navy">{value}</Text>
      <Text className="mt-0.5 font-inter text-[9px] leading-4 text-ink-muted">{hint}</Text>
    </Card>
  );
}

function CandidateOverview({ userId }: { userId: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [media, setMedia] = useState<CandidateMedia | null>(null);
  const [latestReview, setLatestReview] = useState<ReviewRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [{ data: profileData, error: profileError }, { data: mediaData }, { data: reviews }] =
        await Promise.all([
          supabase.from("candidate_profiles").select("*").eq("user_id", userId).maybeSingle(),
          supabase.from("candidate_media").select("*").eq("candidate_id", userId).maybeSingle(),
          supabase
            .from("verification_reviews")
            .select("decision, rejection_reason, created_at")
            .eq("candidate_id", userId)
            .order("created_at", { ascending: false })
            .limit(1),
        ]);

      if (profileError) throw profileError;

      setProfile((profileData as CandidateProfile | null) ?? null);
      setMedia((mediaData as CandidateMedia | null) ?? null);
      setLatestReview((reviews?.[0] as ReviewRow | undefined) ?? null);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load your dashboard.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading && !profile) {
    return (
      <Card>
        <Text className="font-inter text-[12px] text-ink-muted">Loading your dashboard…</Text>
      </Card>
    );
  }

  if (!profile) {
    return (
      <View className="gap-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Card className="border-accent-indigo/20 bg-accent-indigo-soft/40">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-accent-indigo-soft">
            <Sparkles size={22} color="#4F46E5" />
          </View>
          <Text className="mt-4 font-jakarta-extrabold text-2xl text-brand-navy">
            Finish your candidate profile
          </Text>
          <Text className="mt-2 font-inter text-[12px] leading-6 text-ink-muted">
            Tell employers about your degree and target role. Once your profile is saved you can
            upload your certificate and record your live pitch.
          </Text>
          <Button
            label="Complete profile"
            className="mt-5 self-start"
            icon={<ArrowRight size={15} color="#FFFFFF" />}
            onPress={() => router.push("/candidate/profile")}
          />
        </Card>
      </View>
    );
  }

  const status = profile.verification_status;
  const displayName = profile.full_name.split(" ")[0] ?? profile.full_name;

  const checklist = [
    {
      label: "Profile details",
      done: true,
      hint: `${profile.degree_level} · ${profile.university_name}`,
    },
    {
      label: "Private certificate",
      done: Boolean(media?.certificate_r2_key),
      hint: media?.certificate_r2_key ? "Uploaded securely" : "PDF, JPG, or PNG",
    },
    {
      label: "Live pitch video",
      done: Boolean(media?.video_r2_key),
      hint:
        media?.video_duration_seconds != null
          ? formatPitchDuration(media.video_duration_seconds)
          : "60–120 seconds, camera only",
    },
    {
      label: "Admin decision",
      done: status === "verified",
      hint:
        status === "rejected"
          ? "Changes requested"
          : status === "pending"
            ? "In the review queue"
            : status === "verified"
              ? "Approved"
              : "Not submitted yet",
    },
  ];

  return (
    <View className="gap-4">
      <View className="overflow-hidden rounded-2xl bg-brand-navy p-5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="font-inter-semibold text-[9px] uppercase tracking-[2px] text-indigo-300">
              Candidate dashboard
            </Text>
            <Text className="mt-2 font-jakarta-extrabold text-2xl tracking-[-0.6px] text-white">
              Welcome back, {displayName}
            </Text>
            <Text className="mt-2 font-inter text-[11px] leading-5 text-white/55">
              {status === "verified"
                ? "Your profile is verified. Employers can watch your pitch and unlock your contact details."
                : status === "pending"
                  ? "Your documents are with the review team. We will notify you when a decision is made."
                  : status === "rejected"
                    ? "The reviewer asked for changes. Update your documents and resubmit when ready."
                    : "Complete your verification to become discoverable to employers."}
            </Text>
          </View>
          <VerificationBadge status={status} />
        </View>

        <View className="mt-5 flex-row gap-2">
          <Button
            label={
              status === "unverified" || status === "rejected"
                ? "Continue verification"
                : "View verification"
            }
            size="sm"
            icon={<ScanFace size={14} color="#FFFFFF" />}
            onPress={() => router.push("/candidate/verification")}
          />
          <Button
            label="Edit profile"
            size="sm"
            variant="secondary"
            onPress={() => router.push("/candidate/profile")}
          />
          <Button
            label="Messages"
            size="sm"
            variant="secondary"
            onPress={() => router.push("/candidate/messages")}
          />
        </View>
      </View>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {status === "rejected" && profile.rejection_reason ? (
        <Alert tone="error" title="Changes requested">
          {profile.rejection_reason}
        </Alert>
      ) : null}

      <View className="flex-row gap-3">
        <StatCard
          icon={ScanFace}
          label="Verification"
          value={
            status === "verified"
              ? "Verified"
              : status === "pending"
                ? "In review"
                : status === "rejected"
                  ? "Action needed"
                  : "Not started"
          }
          hint="Document + live pitch"
        />
        <StatCard
          icon={Video}
          label="Pitch length"
          value={
            media?.video_duration_seconds
              ? formatPitchDuration(media.video_duration_seconds)
              : "—"
          }
          hint="Between 01:00 and 02:00"
        />
        <StatCard
          icon={FileText}
          label="Submission"
          value={media?.submitted_at ? "Submitted" : "Draft"}
          hint={
            latestReview
              ? `Decision ${new Date(latestReview.created_at).toLocaleDateString()}`
              : "No decisions yet"
          }
        />
      </View>

      <Card>
        <CardHeader
          title="Verification checklist"
          description="Every gate must be complete before an admin can approve your profile."
        />
        <View className="mt-4 gap-2.5">
          {checklist.map((item, index) => (
            <View
              key={item.label}
              className="flex-row items-center gap-3 rounded-xl border border-line bg-surface-canvas px-3.5 py-3"
            >
              <View
                className={`h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  item.done ? "bg-verified-emerald" : "bg-white ring-1 ring-line"
                }`}
              >
                {item.done ? (
                  <BadgeCheck size={15} color="#FFFFFF" />
                ) : (
                  <Text className="font-jakarta-bold text-[11px] text-ink-muted">
                    {index + 1}
                  </Text>
                )}
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-inter-semibold text-[12px] text-brand-navy">
                  {item.label}
                </Text>
                <Text className="font-inter text-[10px] text-ink-muted" numberOfLines={1}>
                  {item.hint}
                </Text>
              </View>
              <Badge tone={item.done ? "emerald" : "neutral"}>
                {item.done ? "Complete" : "Pending"}
              </Badge>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

function EmployerOverview({ userId }: { userId: string }) {
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [{ data: companyData, error: companyError }, { data: balanceData }] =
        await Promise.all([
          supabase.from("companies").select("*").eq("owner_id", userId).maybeSingle(),
          supabase.rpc("get_my_credit_balance"),
        ]);

      if (companyError) throw companyError;

      setCompany((companyData as Company | null) ?? null);
      setBalance(Number(balanceData ?? 0));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load your workspace.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading && !company) {
    return (
      <Card>
        <Text className="font-inter text-[12px] text-ink-muted">Loading your workspace…</Text>
      </Card>
    );
  }

  if (!company) {
    return (
      <View className="gap-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Card className="border-accent-indigo/20 bg-accent-indigo-soft/40">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-accent-indigo-soft">
            <Building2 size={22} color="#4F46E5" />
          </View>
          <Text className="mt-4 font-jakarta-extrabold text-2xl text-brand-navy">
            Set up your company
          </Text>
          <Text className="mt-2 font-inter text-[12px] leading-6 text-ink-muted">
            Confirm your company name and logo consent. Your corporate email domain is verified
            automatically, and two trial credits are granted once per company.
          </Text>
          <Button
            label="Create company profile"
            className="mt-5 self-start"
            icon={<ArrowRight size={15} color="#FFFFFF" />}
            onPress={() => router.push("/employer/company")}
          />
        </Card>
      </View>
    );
  }

  return (
    <View className="gap-4">
      <View className="rounded-2xl bg-brand-navy p-5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="font-inter-semibold text-[9px] uppercase tracking-[2px] text-indigo-300">
              Employer workspace
            </Text>
            <Text className="mt-2 font-jakarta-extrabold text-2xl tracking-[-0.6px] text-white">
              {company.company_name}
            </Text>
            <Text className="mt-1 font-inter text-[11px] text-white/55">
              {company.corporate_domain} · {company.is_verified ? "Company verified" : "Verification pending"}
            </Text>
          </View>
          <Badge tone={company.is_verified ? "emerald" : "warning"}>
            {company.is_verified ? "Verified" : "Unverified"}
          </Badge>
        </View>
      </View>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <View className="flex-row gap-3">
        <StatCard
          icon={CreditCard}
          label="Credits"
          value={`${balance}`}
          hint="Immutable ledger balance"
        />
        <StatCard
          icon={Building2}
          label="Domain"
          value={company.corporate_domain}
          hint="Locked to your work email"
        />
        <StatCard
          icon={BadgeCheck}
          label="Logo consent"
          value={company.display_logo_consent ? "Opted in" : "Opted out"}
          hint="Landing-page marquee"
        />
      </View>

      <Card>
        <CardHeader
          title="Employer tools"
          description="Manage your company, discover candidates, and buy credits."
        />
        <View className="mt-3 gap-2">
          <Button
            label="Edit company"
            variant="secondary"
            size="sm"
            onPress={() => router.push("/employer/company")}
          />
          <Button
            label="Discover candidates"
            size="sm"
            onPress={() => router.push("/employer/candidates")}
          />
          <Button
            label="Billing & credits"
            size="sm"
            variant="secondary"
            onPress={() => router.push("/employer/billing")}
          />
        </View>
      </Card>
    </View>
  );
}

function AdminOverview() {
  const [pendingCount, setPendingCount] = useState(0);
  const [recentReviews, setRecentReviews] = useState<
    { id: string; decision: string; reviewer_email: string; created_at: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [{ count, error: countError }, { data: reviews }] = await Promise.all([
        supabase
          .from("candidate_profiles")
          .select("user_id", { count: "exact", head: true })
          .eq("verification_status", "pending"),
        supabase
          .from("verification_reviews")
          .select("id, decision, reviewer_email, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (countError) throw countError;

      setPendingCount(count ?? 0);
      setRecentReviews(reviews ?? []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the review queue.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View className="gap-4">
      <View className="rounded-2xl bg-brand-navy p-5">
        <Text className="font-inter-semibold text-[9px] uppercase tracking-[2px] text-indigo-300">
          Admin workspace
        </Text>
        <Text className="mt-2 font-jakarta-extrabold text-2xl tracking-[-0.6px] text-white">
          Verification review
        </Text>
        <Text className="mt-2 font-inter text-[11px] leading-5 text-white/55">
          Candidates submit a private certificate and a live pitch. Review decisions are recorded
          with an immutable audit trail on the web portal.
        </Text>
      </View>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <View className="flex-row gap-3">
        <StatCard
          icon={ClipboardCheck}
          label="Pending"
          value={String(pendingCount)}
          hint="Candidates waiting"
        />
        <StatCard
          icon={BadgeCheck}
          label="Recent"
          value={String(recentReviews.length)}
          hint="Latest decisions"
        />
      </View>

      <Card>
        <CardHeader
          title="Review queue"
          description="Open the web admin portal to inspect certificates, OCR text, and pitch videos."
        />
        <View className="mt-4 gap-2.5">
          {recentReviews.length === 0 ? (
            <Text className="font-inter text-[12px] text-ink-muted">
              No decisions recorded yet.
            </Text>
          ) : (
            recentReviews.map((review) => (
              <View
                key={review.id}
                className="flex-row items-center justify-between gap-2 rounded-xl border border-line bg-surface-canvas px-3.5 py-2.5"
              >
                <View className="flex-1">
                  <Text className="font-inter-semibold text-[12px] capitalize text-brand-navy">
                    {review.decision}
                  </Text>
                  <Text className="font-inter text-[9px] text-ink-muted">
                    {review.reviewer_email}
                  </Text>
                </View>
                <Text className="font-inter text-[9px] text-ink-muted">
                  {new Date(review.created_at).toLocaleDateString()}
                </Text>
              </View>
            ))
          )}
        </View>
      </Card>
    </View>
  );
}

export default function DashboardScreen() {
  const { user, loading, profile } = useAuth();

  if (loading || !user) {
    return (
      <Screen>
        <Card>
          <Text className="font-inter text-[12px] text-ink-muted">Loading your account…</Text>
        </Card>
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
        <Card>
          <View className="flex-row items-center gap-2">
            <CheckCircle2 size={16} color="#10B981" />
            <Text className="font-jakarta-bold text-[15px] text-brand-navy">
              Setting up your account
            </Text>
          </View>
          <Text className="mt-2 font-inter text-[12px] leading-5 text-ink-muted">
            Your profile row is still being created. Pull to refresh in a moment, or sign out and
            sign back in.
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      {profile.role === "candidate" ? (
        <CandidateOverview userId={user.id} />
      ) : profile.role === "employer" ? (
        <EmployerOverview userId={user.id} />
      ) : (
        <AdminOverview />
      )}
    </Screen>
  );
}
