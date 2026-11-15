import { useFocusEffect, useRouter } from "expo-router";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  CheckCircle2,
  Clock3,
  FileCheck2,
  LockKeyhole,
  RotateCcw,
  ScanFace,
  ShieldAlert,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import {
  formatPitchDuration,
  type CandidateMedia,
  type CandidateProfile,
  type VerificationReview,
} from "@utn/shared";

import { Screen } from "@/components/screen";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { VerificationBadge } from "@/components/verification-badge";
import { VerificationStudio } from "@/components/verification-studio";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

function LockedSubmission({
  profile,
  media,
  decision,
}: {
  profile: CandidateProfile;
  media: CandidateMedia | null;
  decision: "pending" | "verified";
}) {
  const router = useRouter();
  const verified = decision === "verified";

  const steps = [
    { label: "Certificate uploaded", done: Boolean(media?.certificate_r2_key) },
    {
      label: `Live pitch recorded (${formatPitchDuration(media?.video_duration_seconds ?? 0)})`,
      done: Boolean(media?.video_r2_key),
    },
    {
      label: verified ? "University verified" : "Admin review in progress",
      done: verified,
    },
  ];

  return (
    <View className="gap-4">
      <Card
        className={
          verified
            ? "border-verified-emerald/30 bg-verified-emerald-soft/40"
            : "border-warning/20 bg-amber-50/60"
        }
      >
        <View className="flex-row items-start gap-3">
          <View
            className={`h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              verified ? "bg-verified-emerald" : "bg-warning"
            }`}
          >
            {verified ? (
              <BadgeCheck size={24} color="#FFFFFF" />
            ) : (
              <Clock3 size={24} color="#FFFFFF" />
            )}
          </View>
          <View className="flex-1">
            <Text className="font-inter-semibold text-[9px] uppercase tracking-[1.6px] text-ink-muted">
              Verification status
            </Text>
            <Text className="mt-1 font-jakarta-extrabold text-xl text-brand-navy">
              {verified ? "Your degree is verified" : "Your submission is under review"}
            </Text>
            <Text className="mt-2 font-inter text-[11px] leading-5 text-ink-muted">
              {verified
                ? "Employers can now find your profile, watch your pitch, and unlock your contact details with a credit."
                : "Media is locked while an admin compares your certificate with your profile and live pitch. You will see the decision here as soon as it is recorded."}
            </Text>
          </View>
        </View>

        <View className="mt-4 gap-2">
          {steps.map((step) => (
            <View
              key={step.label}
              className="flex-row items-center gap-2 rounded-xl border border-line bg-white/70 px-3 py-2.5"
            >
              <View
                className={`h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  step.done ? "bg-verified-emerald" : "bg-surface-muted"
                }`}
              >
                {step.done ? (
                  <CheckCircle2 size={13} color="#FFFFFF" />
                ) : (
                  <Clock3 size={13} color="#64748B" />
                )}
              </View>
              <Text className="flex-1 font-inter-medium text-[10px] leading-4 text-brand-navy">
                {step.label}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <View className="gap-4">
        <Card>
          <CardHeader title="Submitted profile" description="What the reviewer sees." />
          <View className="mt-4 gap-3">
            {[
              ["Name", profile.full_name],
              ["University", profile.university_name],
              ["Degree", profile.degree_level],
              ["Graduation", String(profile.graduation_year)],
            ].map(([label, value]) => (
              <View
                key={label}
                className="flex-row items-center justify-between gap-3 border-b border-line pb-2 last:border-0 last:pb-0"
              >
                <Text className="font-inter text-[10px] text-ink-muted">{label}</Text>
                <Text className="flex-1 text-right font-inter-semibold text-[10px] text-brand-navy">
                  {value}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <Card>
          <CardHeader title="Private media" description="Short-lived signed links only." />
          <View className="mt-4 gap-2">
            <View className="flex-row items-center gap-2 rounded-xl border border-line bg-surface-canvas p-3">
              <FileCheck2 size={15} color="#4F46E5" />
              <Text className="flex-1 font-inter-medium text-[10px] text-brand-navy">
                Degree certificate
              </Text>
              <Badge tone="emerald">Stored</Badge>
            </View>
            <View className="flex-row items-center gap-2 rounded-xl border border-line bg-surface-canvas p-3">
              <Camera size={15} color="#4F46E5" />
              <Text className="flex-1 font-inter-medium text-[10px] text-brand-navy">
                Live pitch · {formatPitchDuration(media?.video_duration_seconds ?? 0)}
              </Text>
              <Badge tone="emerald">Stored</Badge>
            </View>
          </View>
          <View className="mt-3 flex-row items-start gap-1.5">
            <LockKeyhole size={12} color="#64748B" style={{ marginTop: 1 }} />
            <Text className="flex-1 font-inter text-[9px] leading-4 text-ink-muted">
              Uploads are locked while your verification is {verified ? "approved" : "pending"}.
            </Text>
          </View>
        </Card>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <Button
          label="Back to dashboard"
          size="sm"
          icon={<ArrowRight size={14} color="#FFFFFF" />}
          onPress={() => router.push("/dashboard")}
        />
        <Button
          label="View profile"
          size="sm"
          variant="secondary"
          onPress={() => router.push("/candidate/profile")}
        />
      </View>
    </View>
  );
}

export default function CandidateVerificationScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [media, setMedia] = useState<CandidateMedia | null>(null);
  const [reviews, setReviews] = useState<VerificationReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;

    try {
      const [{ data: profileData, error: profileError }, { data: mediaData }, { data: reviewData }] =
        await Promise.all([
          supabase.from("candidate_profiles").select("*").eq("user_id", user.id).maybeSingle(),
          supabase.from("candidate_media").select("*").eq("candidate_id", user.id).maybeSingle(),
          supabase
            .from("verification_reviews")
            .select("id, candidate_id, reviewer_id, reviewer_email, decision, rejection_reason, created_at")
            .eq("candidate_id", user.id)
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

      if (profileError) throw profileError;

      setProfile((profileData as CandidateProfile | null) ?? null);
      setMedia((mediaData as CandidateMedia | null) ?? null);
      setReviews((reviewData as VerificationReview[] | null) ?? []);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load your verification.",
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading && !profile) {
    return (
      <Screen>
        <Card>
          <Text className="font-inter text-[12px] text-ink-muted">
            Loading your verification…
          </Text>
        </Card>
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
        {error ? (
          <Alert tone="error" className="mb-4">
            {error}
          </Alert>
        ) : null}
        <Card className="border-accent-indigo/20 bg-accent-indigo-soft/40">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-accent-indigo-soft">
            <ScanFace size={22} color="#4F46E5" />
          </View>
          <Text className="mt-4 font-jakarta-extrabold text-2xl text-brand-navy">
            Complete your profile first
          </Text>
          <Text className="mt-2 font-inter text-[12px] leading-6 text-ink-muted">
            Verification compares your certificate with your degree, university, and graduation
            year. Add those details before uploading documents.
          </Text>
          <Button
            label="Go to profile"
            className="mt-5 self-start"
            icon={<ArrowRight size={15} color="#FFFFFF" />}
            onPress={() => router.push("/candidate/profile")}
          />
        </Card>
      </Screen>
    );
  }

  const status = profile.verification_status;

  return (
    <Screen>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="font-inter-semibold text-[9px] uppercase tracking-[2px] text-accent-indigo">
            Candidate verification
          </Text>
          <Text className="mt-2 font-jakarta-extrabold text-2xl tracking-[-0.6px] text-brand-navy">
            Prove your degree. Pitch live.
          </Text>
          <Text className="mt-1 font-inter text-[11px] leading-5 text-ink-muted">
            Two gates: a private degree document and an unedited 60–120 second pitch recorded from
            your camera. Submit unlocks at exactly 01:00.
          </Text>
        </View>
        <VerificationBadge status={status} />
      </View>

      {error ? (
        <Alert tone="error" className="mt-4">
          {error}
        </Alert>
      ) : null}

      <View className="mt-5">
        {status === "pending" ? (
          <LockedSubmission profile={profile} media={media} decision="pending" />
        ) : status === "verified" ? (
          <LockedSubmission profile={profile} media={media} decision="verified" />
        ) : (
          <View className="gap-4">
            {status === "rejected" ? (
              <Alert tone="error" title="Changes requested">
                {profile.rejection_reason ??
                  "A reviewer asked for a new submission. Re-upload a clear document and re-record your pitch."}
              </Alert>
            ) : null}

            <VerificationStudio onSubmitted={() => void load()} />

            {status === "rejected" ? (
              <View className="flex-row items-center gap-2">
                <RotateCcw size={13} color="#64748B" />
                <Text className="flex-1 font-inter text-[10px] text-ink-muted">
                  Resubmitting replaces your previous certificate and pitch once you send it for
                  review.
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </View>

      {reviews.length > 0 ? (
        <Card className="mt-4">
          <CardHeader
            title="Review history"
            description="Append-only decisions from the verification team."
          />
          <View className="mt-4 gap-2.5">
            {reviews.map((review) => (
              <View
                key={review.id}
                className="flex-row items-start gap-3 rounded-xl border border-line bg-surface-canvas p-3.5"
              >
                <View
                  className={`mt-0.5 h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    review.decision === "verified"
                      ? "bg-verified-emerald-soft"
                      : "bg-red-50"
                  }`}
                >
                  {review.decision === "verified" ? (
                    <BadgeCheck size={15} color="#10B981" />
                  ) : (
                    <ShieldAlert size={15} color="#DC2626" />
                  )}
                </View>
                <View className="flex-1">
                  <View className="flex-row flex-wrap items-center justify-between gap-2">
                    <Text className="font-inter-semibold text-[11px] capitalize text-brand-navy">
                      {review.decision === "verified" ? "Approved" : "Changes requested"}
                    </Text>
                    <Text className="font-inter text-[9px] text-ink-muted">
                      {new Date(review.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  {review.rejection_reason ? (
                    <Text className="mt-1 font-inter text-[10px] leading-5 text-ink-muted">
                      {review.rejection_reason}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}
