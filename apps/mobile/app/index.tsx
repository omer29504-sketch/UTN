import { useRouter } from "expo-router";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Camera,
  Check,
  Clock3,
  CreditCard,
  FileCheck2,
  KeyRound,
  LockKeyhole,
  Play,
  ScanText,
  ShieldCheck,
  Sparkles,
  Timer,
  UserRound,
  Video,
} from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  FREE_TRIAL_CREDITS,
  MAX_PITCH_SECONDS,
  MIN_PITCH_SECONDS,
  TELEPROMPTER_CUES,
  UNLOCK_COST_CREDITS,
  formatPitchDuration,
} from "@utn/shared";

import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";

const steps = [
  {
    icon: FileCheck2,
    title: "Prove your degree",
    body: "Upload a private certificate. tesseract.js reads the text, and an admin compares it with your profile.",
  },
  {
    icon: Camera,
    title: "Pitch live for 60–120s",
    body: "A front-camera recording with teleprompter cues. Gallery uploads are disabled by design.",
  },
  {
    icon: BadgeCheck,
    title: "Get verified",
    body: "Approved graduates become searchable. Employers watch the pitch for free, then spend a credit to unlock contact details.",
  },
] as const;

const rules = [
  { icon: Timer, value: "60–120s", label: "Live pitch window" },
  { icon: LockKeyhole, value: "Private", label: "Certificates by default" },
  { icon: CreditCard, value: `${FREE_TRIAL_CREDITS} free`, label: "Employer trial credits" },
  { icon: KeyRound, value: `${UNLOCK_COST_CREDITS} credit`, label: "One profile unlock" },
] as const;

const phases = [
  { number: 1, title: "Monorepo, database & storage", status: "complete" },
  { number: 2, title: "Auth, verification & admin review", status: "complete" },
  { number: 3, title: "Discovery, credits & Stripe", status: "next" },
  { number: 4, title: "Marquee, Priority Pro & chat", status: "queued" },
] as const;

export default function LandingScreen() {
  const router = useRouter();
  const { session } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-surface-canvas" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 py-3">
        <BrandMark />
        <Badge tone="emerald" icon={<View className="h-1.5 w-1.5 rounded-full bg-verified-emerald" />}>
          Phase 2 shipped
        </Badge>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-6">
          <View className="flex-row items-center gap-1.5 self-start rounded-full border border-line bg-white px-3 py-1.5">
            <Sparkles size={12} color="#4F46E5" />
            <Text className="font-inter-medium text-[10px] text-ink-muted">
              Verified talent · zero-cost infrastructure
            </Text>
          </View>

          <Text className="mt-5 font-jakarta-extrabold text-[38px] leading-[44px] tracking-[-1.2px] text-brand-navy">
            Verified talent.{"\n"}
            <Text className="text-ink-muted">Real potential.</Text>
          </Text>

          <Text className="mt-4 font-inter text-[14px] leading-6 text-ink-muted">
            Graduates prove their degree and pitch live. Employers watch every pitch for free and
            spend a credit only when they are ready to talk.
          </Text>

          <View className="mt-6 gap-2.5">
            <Button
              label={session ? "Open your dashboard" : "Create your account"}
              size="lg"
              icon={<ArrowRight size={16} color="#FFFFFF" />}
              onPress={() =>
                router.push(session ? "/dashboard" : "/auth/sign-up")
              }
            />
            <Button
              label={session ? "Switch account" : "Sign in to continue"}
              size="lg"
              variant="secondary"
              onPress={() =>
                router.push(session ? "/auth/sign-in" : "/auth/sign-in")
              }
            />
          </View>
        </View>

        {/* Pitch preview */}
        <View className="mt-8 overflow-hidden rounded-3xl bg-studio-obsidian">
          <View className="flex-row items-center justify-between border-b border-white/10 px-4 py-3">
            <View className="flex-row items-center gap-2">
              <View className="h-1.5 w-1.5 rounded-full bg-verified-emerald" />
              <Text className="font-inter-semibold text-[10px] text-white/70">
                Camera-only pitch studio
              </Text>
            </View>
            <View className="flex-row items-center gap-1 rounded-full border border-verified-emerald/30 bg-verified-emerald/10 px-2 py-1">
              <Timer size={10} color="#10B981" />
              <Text className="font-inter-semibold text-[10px] text-verified-emerald">
                {formatPitchDuration(72)}
              </Text>
            </View>
          </View>

          <View className="h-[240px] items-center justify-center bg-studio-obsidian-soft">
            <View className="absolute inset-x-4 top-4 rounded-xl border border-white/10 bg-white/[0.06] p-3">
              <Text className="font-inter-semibold text-[8px] uppercase tracking-[2px] text-white/40">
                Teleprompter · cue 1 of {TELEPROMPTER_CUES.length}
              </Text>
              <Text className="mt-1 font-jakarta-bold text-xs text-white">
                {TELEPROMPTER_CUES[0]?.title}
              </Text>
              <Text className="mt-0.5 font-inter text-[9px] leading-4 text-white/45">
                {TELEPROMPTER_CUES[0]?.prompt}
              </Text>
            </View>

            <View className="mt-10 h-28 w-28 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
              <UserRound size={54} color="rgba(255,255,255,0.18)" strokeWidth={1.1} />
            </View>

            <View className="absolute inset-x-4 bottom-4">
              <View className="h-1.5 overflow-hidden rounded-full bg-white/15">
                <View className="h-full w-[60%] rounded-full bg-verified-emerald" />
              </View>
              <Text className="mt-1.5 text-center font-inter text-[9px] text-white/55">
                Submit unlocks at 01:00 · stops automatically at 02:00
              </Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between p-4">
            <View className="flex-row items-center gap-2">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-white/10">
                <Play size={14} color="#FFFFFF" />
              </View>
              <View>
                <Text className="font-jakarta-bold text-[12px] text-white">
                  Verified Candidate #0421
                </Text>
                <Text className="font-inter text-[9px] text-white/45">
                  Graduate software engineer · University of Cape Town
                </Text>
              </View>
            </View>
            <Badge tone="emerald">Verified</Badge>
          </View>
        </View>

        {/* Steps */}
        <View className="mt-9">
          <Text className="font-inter-semibold text-[9px] uppercase tracking-[2.4px] text-accent-indigo">
            How verification works
          </Text>
          <Text className="mt-2 font-jakarta-extrabold text-2xl tracking-[-0.6px] text-brand-navy">
            Three gates. One trusted profile.
          </Text>

          <View className="mt-4 gap-3">
            {steps.map((step, index) => (
              <Card key={step.title} className="flex-row gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent-indigo-soft">
                  <step.icon size={18} color="#4F46E5" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="font-inter-semibold text-[9px] text-ink-muted">
                      0{index + 1}
                    </Text>
                    <Text className="font-jakarta-bold text-[13px] text-brand-navy">
                      {step.title}
                    </Text>
                  </View>
                  <Text className="mt-1 font-inter text-[11px] leading-5 text-ink-muted">
                    {step.body}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        </View>

        {/* Rules */}
        <View className="mt-9">
          <Text className="font-inter-semibold text-[9px] uppercase tracking-[2.4px] text-accent-indigo">
            Product guardrails
          </Text>
          <Text className="mt-2 font-jakarta-extrabold text-2xl tracking-[-0.6px] text-brand-navy">
            Rules in the schema
          </Text>

          <View className="mt-4 flex-row flex-wrap gap-3">
            {rules.map((rule) => (
              <Card key={rule.label} className="w-[47%] p-4">
                <rule.icon size={17} color="#0F172A" />
                <Text className="mt-3 font-jakarta-extrabold text-lg text-brand-navy">
                  {rule.value}
                </Text>
                <Text className="font-inter-medium text-[10px] text-ink-muted">
                  {rule.label}
                </Text>
              </Card>
            ))}
          </View>

          <Card className="mt-3 flex-row items-center gap-3">
            <Building2 size={18} color="#4F46E5" />
            <View className="flex-1">
              <Text className="font-jakarta-bold text-[12px] text-brand-navy">
                Corporate email gate
              </Text>
              <Text className="mt-0.5 font-inter text-[10px] leading-4 text-ink-muted">
                Gmail, Yahoo, Hotmail, Outlook, and iCloud addresses cannot create employer accounts.
              </Text>
            </View>
            <LockKeyhole size={14} color="#10B981" />
          </Card>
        </View>

        {/* OCR callout */}
        <View className="mt-9 rounded-2xl bg-brand-navy p-5">
          <View className="flex-row items-center gap-2">
            <ScanText size={16} color="#A5B4FC" />
            <Text className="font-inter-semibold text-[9px] uppercase tracking-[2.4px] text-indigo-300">
              Document intelligence
            </Text>
          </View>
          <Text className="mt-2 font-jakarta-extrabold text-xl text-white">
            OCR assists. Humans decide.
          </Text>
          <Text className="mt-2 font-inter text-[11px] leading-5 text-white/50">
            tesseract.js extracts visible text from images. PDFs and low-confidence scans go to an
            admin for manual review — no automatic approval.
          </Text>

          <View className="mt-4 gap-2">
            {[
              "Private R2 storage · signed links only",
              "Append-only review history",
              "60s minimum enforced server-side",
            ].map((item) => (
              <View key={item} className="flex-row items-center gap-2">
                <Check size={12} color="#10B981" strokeWidth={3} />
                <Text className="font-inter text-[10px] text-white/65">{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Phases */}
        <View className="mt-9">
          <Text className="font-inter-semibold text-[9px] uppercase tracking-[2.4px] text-accent-indigo">
            Execution plan
          </Text>
          <Text className="mt-2 font-jakarta-extrabold text-2xl tracking-[-0.6px] text-brand-navy">
            Phase 2 checkpoint
          </Text>

          <View className="mt-4 gap-2.5">
            {phases.map((phase) => (
              <View
                key={phase.number}
                className={`flex-row items-center gap-3 rounded-2xl border p-3.5 ${
                  phase.status === "complete"
                    ? "border-verified-emerald/20 bg-verified-emerald-soft/60"
                    : "border-line bg-surface-card"
                }`}
              >
                <View
                  className={`h-9 w-9 items-center justify-center rounded-xl ${
                    phase.status === "complete"
                      ? "bg-verified-emerald"
                      : phase.status === "next"
                        ? "bg-accent-indigo"
                        : "bg-surface-muted"
                  }`}
                >
                  {phase.status === "complete" ? (
                    <Check size={17} color="#FFFFFF" strokeWidth={3} />
                  ) : (
                    <Text
                      className={`font-jakarta-bold text-xs ${
                        phase.status === "next" ? "text-white" : "text-ink-muted"
                      }`}
                    >
                      {phase.number}
                    </Text>
                  )}
                </View>
                <View className="flex-1">
                  <Text className="font-inter-medium text-[8px] uppercase tracking-[1.4px] text-ink-muted">
                    Phase {phase.number}
                  </Text>
                  <Text className="font-inter-semibold text-[12px] text-brand-navy">
                    {phase.title}
                  </Text>
                </View>
                <Text
                  className={`font-inter-semibold text-[8px] ${
                    phase.status === "complete"
                      ? "text-emerald-700"
                      : phase.status === "next"
                        ? "text-accent-indigo"
                        : "text-ink-muted"
                  }`}
                >
                  {phase.status === "next"
                    ? "AWAITING OK"
                    : phase.status === "complete"
                      ? "DONE"
                      : "QUEUED"}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Pressable
          onPress={() => router.push(session ? "/dashboard" : "/auth/sign-up")}
          className="mt-8 flex-row items-center justify-center gap-2 rounded-xl bg-brand-navy px-5 py-3.5 active:opacity-80"
        >
          <Text className="font-inter-semibold text-sm text-white">
            {session ? "Open dashboard" : "Start verification"}
          </Text>
          <ArrowRight size={15} color="#FFFFFF" />
        </Pressable>

        <View className="mt-6 items-center gap-2">
          <View className="flex-row items-center gap-1.5">
            <ShieldCheck size={13} color="#10B981" />
            <Text className="font-inter-semibold text-[10px] text-ink-muted">
              Phase 2 checkpoint
            </Text>
          </View>
          <Text className="text-center font-inter text-[9px] leading-4 text-ink-muted/70">
            Authentication, verification, OCR, and admin review are ready. Confirm before Phase 3
            adds discovery, credits, and Stripe.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
