import { useLocalSearchParams, useRouter } from "expo-router";
import * as ScreenCapture from "expo-screen-capture";
import { usePreventScreenCapture } from "expo-screen-capture";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Eye,
  Lock,
  ShieldCheck,
  TimerReset,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert as NativeAlert,
  AppState,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Screen } from "@/components/screen";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch, readApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
  CERTIFICATE_ACK_TICK_MS,
  CERTIFICATE_ACK_TTL_MS,
  CERTIFICATE_REACK_BUTTON_LABEL,
  CERTIFICATE_VIEWER_PRIVACY_SHIELD_TEXT,
  CERTIFICATE_WARNING_POINTS,
  EMPLOYER_CONFIDENTIALITY_CHECKBOX_LABEL,
  EMPLOYER_CONFIDENTIALITY_CLAUSE,
  WATERMARK_REFRESH_MS,
  buildWatermarkSignature,
  certificateAckRemainingMs,
  formatAckCountdown,
  hasAcceptedEmployerTos,
  isCertificateAckExpired,
  type DocumentAuditEventType,
} from "@utn/shared";

type LockReason = "initial" | "expired" | "capture";
type ViewerStatus = "idle" | "loading" | "ready" | "error";
type CertificatePayload = { kind: "image"; uri: string } | { kind: "pdf" } | null;

const IMAGE_HEIGHT = 440;

/**
 * Mobile confidential certificate viewer.
 *
 * Mirrors the web rules:
 *   * OS-level screenshot/recording block via expo-screen-capture
 *   * click-through confidentiality clause before the first view
 *   * every-open + 60-minute re-acknowledgment warning
 *   * screenshot listener closes the document, warns and logs the attempt
 *   * repeating forensic watermark overlay with employer identity + timestamp
 */
export default function EmployerCertificateScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ candidateId?: string | string[] }>();
  const rawCandidateId = params.candidateId;
  const candidateId = Array.isArray(rawCandidateId)
    ? (rawCandidateId[0] ?? "")
    : (rawCandidateId ?? "");

  // Android FLAG_SECURE / iOS recording protection for as long as this screen
  // is mounted.
  usePreventScreenCapture("utn-secure-certificate");

  const [identityLoading, setIdentityLoading] = useState(true);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [employerName, setEmployerName] = useState("Employer");
  const [employerEmail, setEmployerEmail] = useState("");
  const [employerId, setEmployerId] = useState("");
  const [tosAcceptedAt, setTosAcceptedAt] = useState<string | null>(null);

  const [tosChecked, setTosChecked] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [tosError, setTosError] = useState<string | null>(null);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [lockReason, setLockReason] = useState<LockReason>("initial");
  const [lastAckAt, setLastAckAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(CERTIFICATE_ACK_TTL_MS);

  const [shielded, setShielded] = useState(false);
  const [watermarkAt, setWatermarkAt] = useState(() => new Date());
  const [certificate, setCertificate] = useState<CertificatePayload>(null);
  const [status, setStatus] = useState<ViewerStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const lastFocusLogRef = useRef(0);

  const watermarkSignature = buildWatermarkSignature({
    employerName,
    employerEmail,
    employerId: employerId || user?.id || "00000000",
    at: watermarkAt,
  });

  // ── Identity + consent state ─────────────────────────────────────────────

  useEffect(() => {
    if (!user) {
      setIdentityLoading(false);
      return;
    }

    let active = true;
    setIdentityLoading(true);

    (async () => {
      try {
        const [{ data: company }, { data: profile }] = await Promise.all([
          supabase.from("companies").select("company_name").eq("owner_id", user.id).maybeSingle(),
          supabase
            .from("profiles")
            .select("email, employer_tos_accepted_at")
            .eq("id", user.id)
            .maybeSingle(),
        ]);

        if (!active) return;

        setEmployerId(user.id);
        setEmployerEmail(String(profile?.email ?? user.email ?? ""));
        if (company?.company_name) setEmployerName(String(company.company_name));
        setTosAcceptedAt((profile?.employer_tos_accepted_at as string | null | undefined) ?? null);
      } catch (cause) {
        if (active) {
          setIdentityError(
            cause instanceof Error ? cause.message : "Could not load your employer profile.",
          );
        }
      } finally {
        if (active) setIdentityLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [user]);

  // ── Telemetry ────────────────────────────────────────────────────────────

  const logEvent = useCallback(
    (eventType: DocumentAuditEventType) => {
      if (!candidateId) return;
      void apiFetch("/api/employer/certificates/security-event", {
        method: "POST",
        body: JSON.stringify({ eventType, candidateId }),
      }).catch(() => undefined);
    },
    [candidateId],
  );

  // ── Screenshot detection ─────────────────────────────────────────────────

  useEffect(() => {
    if (!candidateId) return;

    const subscription = ScreenCapture.addScreenshotListener(() => {
      setAcknowledged(false);
      setLockReason("capture");
      setCertificate(null);
      setStatus("idle");
      void logEvent("screenshot_attempt");
      NativeAlert.alert(
        "Screenshot attempt recorded",
        "Downloading, printing, or capturing candidate certificates is strictly prohibited. This attempt has been logged and may lead to suspension of your employer account.",
      );
    });

    return () => subscription.remove();
  }, [candidateId, logEvent]);

  // iOS app-switcher privacy blur (no-op on unsupported platforms).
  useEffect(() => {
    void ScreenCapture.enableAppSwitcherProtectionAsync(0.85).catch(() => undefined);
    return () => {
      void ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => undefined);
    };
  }, []);

  // ── Focus loss → privacy shield ──────────────────────────────────────────

  useEffect(() => {
    if (!viewerOpen) return;

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setShielded(false);
        return;
      }

      setShielded(true);
      const now = Date.now();
      if (now - lastFocusLogRef.current > 4_000) {
        lastFocusLogRef.current = now;
        logEvent("focus_loss_blur");
      }
    });

    return () => subscription.remove();
  }, [viewerOpen, logEvent]);

  // ── 60-minute acknowledgment expiry (polled every 10 s) ──────────────────

  useEffect(() => {
    if (!acknowledged || lastAckAt === null) return;

    const tick = () => {
      if (isCertificateAckExpired(lastAckAt)) {
        setAcknowledged(false);
        setLockReason("expired");
        setRemainingMs(0);
        setCertificate(null);
        setStatus("idle");
        return;
      }
      setRemainingMs(certificateAckRemainingMs(lastAckAt));
    };

    tick();
    const interval = setInterval(tick, CERTIFICATE_ACK_TICK_MS);
    return () => clearInterval(interval);
  }, [acknowledged, lastAckAt]);

  // ── Watermark timestamp refresh ──────────────────────────────────────────

  useEffect(() => {
    if (!viewerOpen) return;
    const interval = setInterval(() => setWatermarkAt(new Date()), WATERMARK_REFRESH_MS);
    return () => clearInterval(interval);
  }, [viewerOpen]);

  // ── Fetch the audited bytes only after acknowledgment ────────────────────

  useEffect(() => {
    if (!acknowledged || !candidateId) return;

    let cancelled = false;
    setStatus("loading");
    setError(null);

    (async () => {
      try {
        const response = await apiFetch(
          `/api/employer/certificates/${candidateId}/stream?format=base64`,
          { method: "GET" },
        );

        if (!response.ok) {
          if (!cancelled) {
            setError(await readApiError(response));
            setStatus("error");
          }
          return;
        }

        const body = (await response.json()) as {
          contentType?: string;
          base64?: string;
        };

        if (cancelled) return;

        const contentType = (body.contentType ?? "").toLowerCase();

        if (contentType === "application/pdf") {
          // React Native has no canvas/PDF renderer; the audited bytes are
          // intentionally not persisted, so show a secure notice instead.
          setCertificate({ kind: "pdf" });
          setStatus("ready");
          return;
        }

        if (!body.base64) {
          setError("This certificate could not be displayed.");
          setStatus("error");
          return;
        }

        setCertificate({
          kind: "image",
          uri: `data:${contentType || "image/jpeg"};base64,${body.base64}`,
        });
        setStatus("ready");
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Could not open the document.");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [acknowledged, candidateId]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const acceptConfidentiality = useCallback(async () => {
    if (!tosChecked || !candidateId) return;
    setAccepting(true);
    setTosError(null);

    try {
      const response = await apiFetch("/api/employer/certificates/security-event", {
        method: "POST",
        body: JSON.stringify({ eventType: "tos_accepted", candidateId }),
      });

      if (!response.ok) {
        setTosError(await readApiError(response));
        return;
      }

      const body = (await response.json()) as { employerTosAcceptedAt?: string | null };
      setTosAcceptedAt(body.employerTosAcceptedAt ?? new Date().toISOString());
      setTosChecked(false);
    } catch (cause) {
      setTosError(cause instanceof Error ? cause.message : "Could not record your acceptance.");
    } finally {
      setAccepting(false);
    }
  }, [candidateId, tosChecked]);

  const openViewer = useCallback(() => {
    setViewerOpen(true);
    setAcknowledged(false);
    setLockReason("initial");
    setLastAckAt(null);
    setRemainingMs(CERTIFICATE_ACK_TTL_MS);
    setCertificate(null);
    setStatus("idle");
    setError(null);
  }, []);

  const acknowledge = useCallback(() => {
    setAcknowledged(true);
    setShielded(false);
    setLastAckAt(Date.now());
    setRemainingMs(CERTIFICATE_ACK_TTL_MS);
    logEvent("hourly_reack_completed");
  }, [logEvent]);

  const closeViewer = useCallback(() => {
    setViewerOpen(false);
    setAcknowledged(false);
    setShielded(false);
    setCertificate(null);
    setStatus("idle");
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  if (identityLoading) {
    return (
      <Screen>
        <Card>
          <Text className="font-inter text-[12px] text-ink-muted">Loading secure certificate…</Text>
        </Card>
      </Screen>
    );
  }

  if (identityError) {
    return (
      <Screen>
        <BackLink onPress={() => router.back()} />
        <Alert tone="error" title="Could not open certificate">
          {identityError}
        </Alert>
      </Screen>
    );
  }

  if (!hasAcceptedEmployerTos(tosAcceptedAt)) {
    return (
      <Screen>
        <BackLink onPress={() => router.back()} />

        <Card>
          <View className="flex-row items-start gap-2.5">
            <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-xl bg-brand-navy">
              <ShieldCheck size={16} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text className="font-jakarta-bold text-[15px] text-brand-navy">
                {EMPLOYER_CONFIDENTIALITY_CLAUSE.title}
              </Text>
              <Text className="mt-1 font-inter text-[11px] leading-5 text-ink-muted">
                Version {EMPLOYER_CONFIDENTIALITY_CLAUSE.version} · required before any certificate
                can be displayed.
              </Text>
            </View>
          </View>
        </Card>

        <Card>
          <ScrollView
            nestedScrollEnabled
            style={{ maxHeight: 320 }}
            showsVerticalScrollIndicator
            contentContainerStyle={{ gap: 12 }}
          >
            {EMPLOYER_CONFIDENTIALITY_CLAUSE.sections.map((section) => (
              <View key={section.heading} className="gap-1">
                <Text className="font-inter-semibold text-[12px] text-brand-navy">
                  {section.heading}
                </Text>
                <Text className="font-inter text-[11px] leading-5 text-ink-muted">
                  {section.body}
                </Text>
              </View>
            ))}
          </ScrollView>
        </Card>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: tosChecked }}
          onPress={() => setTosChecked((value) => !value)}
          className="flex-row items-start gap-2.5 rounded-xl border border-line bg-surface-card p-3"
        >
          <View
            className={
              tosChecked
                ? "mt-0.5 h-5 w-5 items-center justify-center rounded-md bg-verified-emerald"
                : "mt-0.5 h-5 w-5 items-center justify-center rounded-md border border-line bg-white"
            }
          >
            {tosChecked ? <Check size={13} color="#FFFFFF" /> : null}
          </View>
          <Text className="flex-1 font-inter text-[11px] leading-5 text-brand-navy">
            {EMPLOYER_CONFIDENTIALITY_CHECKBOX_LABEL}
          </Text>
        </Pressable>

        {tosError ? <Alert tone="error">{tosError}</Alert> : null}

        <Button
          label={accepting ? "Recording acceptance…" : "Accept & continue"}
          icon={<ShieldCheck size={15} color="#FFFFFF" />}
          disabled={!tosChecked || accepting}
          onPress={() => void acceptConfidentiality()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <BackLink onPress={() => router.back()} />

      <Card>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 flex-row items-start gap-2.5">
            <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-xl bg-verified-emerald-soft">
              <Lock size={16} color="#047857" />
            </View>
            <View className="flex-1">
              <Text className="font-jakarta-bold text-[15px] text-brand-navy">
                Confidential certificate
              </Text>
              <Text className="mt-1 font-inter text-[10px] leading-4 text-ink-muted">
                Rendered in memory · watermark and access logged
              </Text>
            </View>
          </View>
          {viewerOpen ? (
            <Button label="Close" size="sm" variant="secondary" onPress={closeViewer} />
          ) : null}
        </View>

        {!viewerOpen ? (
          <View className="mt-3">
            <Button
              label="View certificate (secure viewer)"
              icon={<Eye size={15} color="#FFFFFF" />}
              onPress={openViewer}
            />
          </View>
        ) : (
          <View className="mt-3 overflow-hidden rounded-xl border border-studio-obsidian-line bg-studio-obsidian">
            <View className="relative">
              {certificate?.kind === "image" && !shielded ? (
                <Image
                  source={{ uri: certificate.uri }}
                  style={{ width: "100%", height: IMAGE_HEIGHT }}
                  resizeMode="contain"
                  blurRadius={acknowledged ? 0 : 32}
                />
              ) : null}

              {certificate?.kind === "pdf" && acknowledged ? (
                <View className="items-center justify-center px-6" style={{ height: IMAGE_HEIGHT }}>
                  <ShieldCheck size={22} color="#10B981" />
                  <Text className="mt-2 text-center font-inter-semibold text-[12px] text-white">
                    PDF certificate protected
                  </Text>
                  <Text className="mt-1 text-center font-inter text-[10px] leading-4 text-white/60">
                    This document was fetched securely but cannot be rendered on mobile. Review it
                    in the secure web viewer. No file was saved to this device.
                  </Text>
                </View>
              ) : null}

              {status === "loading" ? (
                <View
                  className="absolute inset-0 items-center justify-center bg-studio-obsidian/90"
                  style={{ height: IMAGE_HEIGHT }}
                >
                  <Text className="font-inter-semibold text-[11px] text-white/80">
                    Decrypting certificate…
                  </Text>
                </View>
              ) : null}

              {status === "error" ? (
                <View
                  className="absolute inset-0 items-center justify-center bg-studio-obsidian px-6"
                  style={{ height: IMAGE_HEIGHT }}
                >
                  <Text className="text-center font-inter text-[11px] leading-5 text-red-300">
                    {error ?? "Could not display this certificate."}
                  </Text>
                </View>
              ) : null}

              {acknowledged && !shielded && certificate?.kind === "image" ? (
                <MobileWatermark signature={watermarkSignature} />
              ) : null}

              {shielded ? <PrivacyShield /> : null}

              {!acknowledged ? (
                <AckModal
                  reason={lockReason}
                  employerEmail={employerEmail}
                  remainingMs={remainingMs}
                  onAcknowledge={acknowledge}
                />
              ) : null}
            </View>
          </View>
        )}

        {viewerOpen && acknowledged ? (
          <View className="mt-3 flex-row items-center gap-1.5">
            <TimerReset size={13} color="#64748B" />
            <Text className="font-inter text-[10px] text-ink-muted">
              Acknowledgment expires in {formatAckCountdown(remainingMs)}.
            </Text>
          </View>
        ) : null}
      </Card>
    </Screen>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function BackLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-1.5 self-start"
    >
      <ArrowLeft size={15} color="#4F46E5" />
      <Text className="font-inter-semibold text-[12px] text-accent-indigo">Back</Text>
    </Pressable>
  );
}

function MobileWatermark({ signature }: { signature: string }) {
  const rows = Array.from({ length: 10 }, (_, index) => index);

  return (
    <View
      pointerEvents="none"
      className="absolute inset-0 overflow-hidden"
      style={{ height: IMAGE_HEIGHT }}
    >
      {rows.map((row) => (
        <Text
          key={row}
          numberOfLines={1}
          style={{
            position: "absolute",
            top: 8 + row * 48,
            left: -60,
            width: 640,
            opacity: 0.2,
            color: "#0F172A",
            fontSize: 10,
            fontWeight: "600",
            transform: [{ rotate: "-24deg" }],
          }}
        >
          {signature} {signature}
        </Text>
      ))}
      <View className="absolute bottom-1 right-2 rounded bg-brand-navy/70 px-1.5 py-0.5">
        <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 8, fontWeight: "600" }}>
          {signature}
        </Text>
      </View>
    </View>
  );
}

function PrivacyShield() {
  return (
    <View
      className="absolute inset-0 items-center justify-center bg-brand-navy px-6"
      style={{ height: IMAGE_HEIGHT }}
    >
      <Lock size={22} color="#10B981" />
      <Text className="mt-2 text-center font-jakarta-bold text-[13px] text-white">
        {CERTIFICATE_VIEWER_PRIVACY_SHIELD_TEXT}
      </Text>
      <Text className="mt-1 text-center font-inter text-[10px] leading-4 text-white/60">
        Return to this app to continue. Every hide event is recorded.
      </Text>
    </View>
  );
}

function AckModal({
  reason,
  employerEmail,
  remainingMs,
  onAcknowledge,
}: {
  reason: LockReason;
  employerEmail: string;
  remainingMs: number;
  onAcknowledge: () => void;
}) {
  const heading =
    reason === "expired"
      ? "Session re-acknowledgment required"
      : reason === "capture"
        ? "Capture attempt blocked"
        : "Confidential candidate document";

  return (
    <View
      className="absolute inset-0 justify-center bg-brand-navy px-4 py-4"
      style={{ minHeight: IMAGE_HEIGHT }}
    >
      <View className="gap-3 rounded-2xl border border-verified-emerald/30 bg-brand-navy p-4">
        <View className="flex-row items-start gap-2.5">
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-verified-emerald/15">
            <AlertTriangle size={18} color="#10B981" />
          </View>
          <View className="flex-1">
            <Text className="font-jakarta-bold text-[14px] text-white">{heading}</Text>
            <Text className="mt-1 font-inter text-[10px] leading-4 text-white/60">
              {reason === "expired"
                ? "Your 60-minute acknowledgment window has ended. Confirm again to continue."
                : `Access is restricted to ${employerEmail || "your employer account"}.`}
            </Text>
          </View>
        </View>

        <View className="gap-1.5">
          {CERTIFICATE_WARNING_POINTS.map((point) => (
            <View key={point} className="flex-row gap-2">
              <View className="mt-1.5 h-1.5 w-1.5 rounded-full bg-verified-emerald" />
              <Text className="flex-1 font-inter text-[10px] leading-4 text-white/75">{point}</Text>
            </View>
          ))}
        </View>

        <View className="gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
          <Text className="font-inter text-[10px] leading-4 text-white/70">
            <Text className="font-inter-semibold text-white">Account: </Text>
            {employerEmail || "—"}
          </Text>
          <Text className="font-inter text-[10px] leading-4 text-white/70">
            <Text className="font-inter-semibold text-white">Session: </Text>
            your IP address, device and access time are recorded for this document.
          </Text>
          {reason === "expired" ? (
            <Text className="font-inter text-[10px] leading-4 text-white/70">
              <Text className="font-inter-semibold text-white">Previous window: </Text>
              {formatAckCountdown(remainingMs)} remaining
            </Text>
          ) : null}
        </View>

        <Button label={CERTIFICATE_REACK_BUTTON_LABEL} variant="emerald" onPress={onAcknowledge} />
      </View>
    </View>
  );
}
