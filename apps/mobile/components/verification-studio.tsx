import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import * as DocumentPicker from "expo-document-picker";
import { ResizeMode, Video } from "expo-av";
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  FileCheck2,
  FileText,
  Loader2,
  LockKeyhole,
  Play,
  RotateCcw,
  ScanText,
  Square,
  UploadCloud,
  Video as VideoIcon,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  MAX_PITCH_SECONDS,
  MAX_UPLOAD_BYTES,
  MIN_PITCH_SECONDS,
  TELEPROMPTER_CUES,
  formatBytes,
  formatPitchDuration,
  getPitchProgress,
  getTeleprompterCue,
  type PresignUploadResponse,
} from "@utn/shared";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  apiFetch,
  contentTypeForUri,
  fileSize,
  readApiError,
  uploadToPresignedUrl,
} from "@/lib/api";
import { cn } from "@/lib/cn";

type CertificateStatus = "idle" | "uploading" | "uploaded" | "error";

type CertificateState = {
  status: CertificateStatus;
  key: string | null;
  contentType: string;
  sizeBytes: number;
  fileName: string;
  message: string | null;
};

type OcrState = {
  status: "idle" | "running" | "completed" | "skipped" | "empty" | "failed";
  text: string | null;
  message: string | null;
  confidence: number | null;
};

type VideoState = {
  uri: string | null;
  durationSeconds: number;
  mimeType: string;
  error: string | null;
};

const ACCEPTED_CERTIFICATE_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

function normalizeMime(value: string): string {
  return value.split(";")[0]?.trim().toLowerCase() ?? "";
}

function certificateType(asset: DocumentPicker.DocumentPickerAsset): string | null {
  const direct = normalizeMime(asset.mimeType ?? "");
  if ((ACCEPTED_CERTIFICATE_TYPES as readonly string[]).includes(direct)) return direct;

  const name = asset.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return null;
}

function initialCertificate(): CertificateState {
  return {
    status: "idle",
    key: null,
    contentType: "",
    sizeBytes: 0,
    fileName: "",
    message: null,
  };
}

function initialOcr(): OcrState {
  return { status: "idle", text: null, message: null, confidence: null };
}

function initialVideo(): VideoState {
  return { uri: null, durationSeconds: 0, mimeType: "", error: null };
}

export function VerificationStudio({ onSubmitted }: { onSubmitted?: () => void }) {
  const [certificate, setCertificate] = useState<CertificateState>(initialCertificate);
  const [ocr, setOcr] = useState<OcrState>(initialOcr);
  const [video, setVideo] = useState<VideoState>(initialVideo);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showCues, setShowCues] = useState(true);
  const [recorderError, setRecorderError] = useState<string | null>(null);

  const [verificationRef, setVerificationRef] = useState("");
  const [registrarConsent, setRegistrarConsent] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const cameraRef = useRef<CameraView | null>(null);
  const startedAtRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const cue = useMemo(() => getTeleprompterCue(elapsed), [elapsed]);
  const progress = getPitchProgress(elapsed);
  const permissionsGranted = Boolean(cameraPermission?.granted && microphonePermission?.granted);
  const canFinalize =
    certificate.status === "uploaded" &&
    Boolean(certificate.key) &&
    Boolean(video.uri) &&
    video.durationSeconds >= MIN_PITCH_SECONDS &&
    registrarConsent &&
    !submitting;

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
      cameraRef.current?.stopRecording();
    };
  }, [clearTimer]);

  // ── Certificate upload + OCR ───────────────────────────────────────────────

  async function handleCertificate(asset: DocumentPicker.DocumentPickerAsset) {
    setSubmitError(null);
    const maxUploadBytes = MAX_UPLOAD_BYTES["private-credentials"];
    const contentType = certificateType(asset);

    if (!contentType) {
      setCertificate({
        ...initialCertificate(),
        status: "error",
        message: "Use a PDF, JPG, or PNG file.",
      });
      setOcr(initialOcr());
      return;
    }

    let sizeBytes = asset.size ?? 0;
    try {
      if (!sizeBytes) sizeBytes = await fileSize(asset.uri);
    } catch {
      setCertificate({
        ...initialCertificate(),
        status: "error",
        message: "We could not read the selected file. Try picking it again.",
      });
      setOcr(initialOcr());
      return;
    }

    if (sizeBytes > maxUploadBytes) {
      setCertificate({
        ...initialCertificate(),
        status: "error",
        message: `That file is ${formatBytes(sizeBytes)}. The maximum is ${formatBytes(maxUploadBytes)}.`,
      });
      setOcr(initialOcr());
      return;
    }

    setOcr(initialOcr());
    setCertificate({
      status: "uploading",
      key: null,
      contentType,
      sizeBytes,
      fileName: asset.name,
      message: null,
    });

    try {
      const presignResponse = await apiFetch("/api/storage/presign", {
        method: "POST",
        body: JSON.stringify({
          intent: "upload",
          bucket: "private-credentials",
          contentType,
          contentLength: sizeBytes,
          fileName: asset.name,
        }),
      });

      if (!presignResponse.ok) throw new Error(await readApiError(presignResponse));
      const presigned = (await presignResponse.json()) as PresignUploadResponse;

      await uploadToPresignedUrl(presigned.uploadUrl, asset.uri, contentType);

      setCertificate((current) => ({
        ...current,
        status: "uploaded",
        key: presigned.key,
        message: null,
      }));

      void runOcr(presigned.key);
    } catch (error) {
      setCertificate((current) => ({
        ...current,
        status: "error",
        key: null,
        message: error instanceof Error ? error.message : "The upload failed.",
      }));
      setOcr(initialOcr());
    }
  }

  async function runOcr(certificateR2Key: string) {
    setOcr({ status: "running", text: null, message: null, confidence: null });

    try {
      const response = await apiFetch("/api/verification/ocr", {
        method: "POST",
        body: JSON.stringify({ certificateR2Key }),
      });

      if (!response.ok) {
        setOcr({
          status: "failed",
          text: null,
          message: await readApiError(response),
          confidence: null,
        });
        return;
      }

      const result = (await response.json()) as {
        status: "completed" | "skipped" | "empty";
        text?: string;
        message?: string;
        confidence?: number;
      };

      if (result.status === "completed" && result.text) {
        setOcr({
          status: "completed",
          text: result.text,
          message: null,
          confidence: result.confidence ?? null,
        });
      } else if (result.status === "skipped") {
        setOcr({
          status: "skipped",
          text: null,
          message:
            result.message ??
            "PDF received. An admin will read this document manually during review.",
          confidence: null,
        });
      } else {
        setOcr({
          status: "empty",
          text: null,
          message:
            result.message ??
            "No readable text was found. An admin will review the document manually.",
          confidence: null,
        });
      }
    } catch (error) {
      setOcr({
        status: "failed",
        text: null,
        message:
          error instanceof Error
            ? error.message
            : "We could not read the document. You can still submit it for manual review.",
        confidence: null,
      });
    }
  }

  async function pickCertificate() {
    setSubmitError(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [...ACCEPTED_CERTIFICATE_TYPES],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;

      await handleCertificate(asset);
    } catch (error) {
      setCertificate({
        ...initialCertificate(),
        status: "error",
        message: error instanceof Error ? error.message : "Could not open the file picker.",
      });
    }
  }

  // ── Camera recording ───────────────────────────────────────────────────────

  function stopRecording() {
    cameraRef.current?.stopRecording();
  }

  async function startRecording() {
    setRecorderError(null);
    setSubmitError(null);

    if (!permissionsGranted) {
      const camera = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
      const microphone = microphonePermission?.granted
        ? microphonePermission
        : await requestMicrophonePermission();

      if (!camera.granted || !microphone.granted) {
        setRecorderError(
          "Camera and microphone access are required. Enable both permissions in your device settings.",
        );
        return;
      }
    }

    if (!cameraReady) {
      setRecorderError("The camera is still starting. Try again in a moment.");
      return;
    }

    setVideo(initialVideo());
    setElapsed(0);
    setRecording(true);

    const startedAt = Date.now();
    startedAtRef.current = startedAt;

    clearTimer();
    intervalRef.current = setInterval(() => {
      const seconds = Math.min(
        MAX_PITCH_SECONDS,
        Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
      );
      if (!mountedRef.current) return;
      setElapsed(seconds);
      if (seconds >= MAX_PITCH_SECONDS) {
        stopRecording();
      }
    }, 250);

    try {
      const result = await cameraRef.current?.recordAsync({ maxDuration: MAX_PITCH_SECONDS });
      clearTimer();
      if (!mountedRef.current) return;

      setRecording(false);

      const finalDuration = Math.min(
        MAX_PITCH_SECONDS,
        Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
      );

      if (!result?.uri) {
        setElapsed(0);
        setRecorderError(
          "Recording stopped before it finished. Keep the app open while you record your pitch.",
        );
        return;
      }

      if (finalDuration < MIN_PITCH_SECONDS) {
        setElapsed(0);
        setRecorderError(
          `Your pitch was ${formatPitchDuration(finalDuration)}. Record at least ${formatPitchDuration(MIN_PITCH_SECONDS)} before stopping.`,
        );
        return;
      }

      setElapsed(finalDuration);
      setVideo({
        uri: result.uri,
        durationSeconds: finalDuration,
        mimeType: contentTypeForUri(result.uri),
        error: null,
      });
    } catch (error) {
      clearTimer();
      if (!mountedRef.current) return;
      setRecording(false);
      setElapsed(0);
      setRecorderError(
        error instanceof Error
          ? error.message
          : "The camera could not start. Check your permissions and try again.",
      );
    }
  }

  function discardRecording() {
    setVideo(initialVideo());
    setElapsed(0);
    setCameraReady(false);
    setRecorderError(null);
  }

  // ── Final submission ───────────────────────────────────────────────────────

  async function submitForReview() {
    if (!certificate.key || !video.uri) return;
    if (!registrarConsent) {
      setSubmitError(
        "Confirm the certificate is authentic and authorize registrar verification before submitting.",
      );
      return;
    }
    setSubmitError(null);
    setSubmitting(true);

    try {
      const sizeBytes = await fileSize(video.uri);
      const maxBytes = MAX_UPLOAD_BYTES["pitch-videos"];

      if (sizeBytes <= 0 || sizeBytes > maxBytes) {
        throw new Error(
          sizeBytes > maxBytes
            ? `Your pitch is ${formatBytes(sizeBytes)}. The maximum is ${formatBytes(maxBytes)}.`
            : "The pitch file could not be read. Record it again.",
        );
      }

      const duration = Math.min(
        MAX_PITCH_SECONDS,
        Math.max(MIN_PITCH_SECONDS, Math.round(video.durationSeconds)),
      );
      const extension =
        video.mimeType === "video/quicktime"
          ? "mov"
          : video.mimeType === "video/webm"
            ? "webm"
            : "mp4";

      const presignResponse = await apiFetch("/api/storage/presign", {
        method: "POST",
        body: JSON.stringify({
          intent: "upload",
          bucket: "pitch-videos",
          contentType: video.mimeType,
          contentLength: sizeBytes,
          fileName: `pitch.${extension}`,
          videoDurationSeconds: duration,
        }),
      });

      if (!presignResponse.ok) throw new Error(await readApiError(presignResponse));
      const presigned = (await presignResponse.json()) as PresignUploadResponse;

      await uploadToPresignedUrl(presigned.uploadUrl, video.uri, video.mimeType);

      const finalizeResponse = await apiFetch("/api/verification/finalize", {
        method: "POST",
        body: JSON.stringify({
          certificate: {
            r2Key: certificate.key,
            contentType: certificate.contentType,
            sizeBytes: certificate.sizeBytes,
          },
          video: {
            r2Key: presigned.key,
            durationSeconds: duration,
            contentType: video.mimeType,
            sizeBytes,
          },
          certificateVerificationRef: verificationRef.trim() || null,
          registrarConsentGiven: true,
          registrarConsentAt: new Date().toISOString(),
        }),
      });

      if (!finalizeResponse.ok) throw new Error(await readApiError(finalizeResponse));

      setSubmitted(true);
      onSubmitted?.();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="border-verified-emerald/30 bg-verified-emerald-soft/40">
        <View className="flex-row items-start gap-3">
          <View className="h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-verified-emerald">
            <CheckCircle2 size={24} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text className="font-jakarta-extrabold text-2xl text-brand-navy">
              Submitted for review
            </Text>
            <Text className="mt-2 font-inter text-[12px] leading-6 text-ink-muted">
              Your certificate and live pitch are locked while an admin reviews them. You will see
              the decision on this page and your dashboard.
            </Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              <Badge tone="emerald">Status · Under review</Badge>
              <Badge tone="neutral">{formatPitchDuration(video.durationSeconds)}</Badge>
              <Badge tone="neutral">Camera-only pitch</Badge>
            </View>
          </View>
        </View>
      </Card>
    );
  }

  return (
    <View className="gap-4">
      {submitError ? <Alert tone="error">{submitError}</Alert> : null}

      {/* ── Certificate ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="1. Private certificate"
          description="PDF, JPG, or PNG up to 10 MB. Never shown on a public URL."
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose your degree document"
          disabled={certificate.status === "uploading"}
          onPress={() => void pickCertificate()}
          className={cn(
            "mt-4 items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6",
            certificate.status === "uploaded"
              ? "border-verified-emerald/40 bg-verified-emerald-soft/40"
              : "border-line bg-surface-canvas active:bg-accent-indigo-soft/30",
          )}
        >
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-white">
            {certificate.status === "uploading" ? (
              <Loader2 size={20} color="#4F46E5" />
            ) : certificate.status === "uploaded" ? (
              <FileCheck2 size={20} color="#10B981" />
            ) : (
              <UploadCloud size={20} color="#4F46E5" />
            )}
          </View>
          <Text className="font-inter-semibold text-[12px] text-brand-navy">
            {certificate.status === "uploaded"
              ? certificate.fileName
              : certificate.status === "uploading"
                ? "Uploading securely…"
                : "Choose your degree document"}
          </Text>
          <Text className="text-center font-inter text-[10px] text-ink-muted">
            {certificate.status === "uploaded"
              ? `${formatBytes(certificate.sizeBytes)} · Uploaded`
              : "Your file goes straight to private R2 storage"}
          </Text>
        </Pressable>

        {certificate.message ? (
          <Alert tone="error" className="mt-3">
            {certificate.message}
          </Alert>
        ) : null}

        <View className="mt-5 gap-4">
          <Field
            label="Certificate Verification URL or Serial Number (Optional)"
            hint="If your digital diploma includes a QR verification link or serial number, paste it here to speed up approval."
          >
            <Input
              value={verificationRef}
              onChangeText={setVerificationRef}
              placeholder="https://verify.university.edu/cert/12345 or Serial #884920"
              maxLength={500}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: registrarConsent }}
            accessibilityLabel="Confirm certificate authenticity and authorize registrar verification"
            onPress={() => setRegistrarConsent((current) => !current)}
            className={cn(
              "flex-row items-start gap-3 rounded-xl border p-4",
              registrarConsent
                ? "border-verified-emerald/30 bg-verified-emerald-soft/40"
                : "border-line bg-surface-canvas",
            )}
          >
            <View
              className={cn(
                "mt-0.5 h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                registrarConsent
                  ? "border-verified-emerald bg-verified-emerald"
                  : "border-line bg-white",
              )}
            >
              {registrarConsent ? <Check size={13} color="#FFFFFF" /> : null}
            </View>
            <View className="flex-1 gap-1">
              <Text className="font-inter text-[11px] leading-5 text-ink-primary">
                I confirm this certificate is authentic and authorize University Talent Network to
                contact my university registrar or official verification portal to confirm my
                degree.
              </Text>
              <Text className="font-inter text-[10px] leading-4 text-ink-muted">
                Required before you can submit for review.
              </Text>
            </View>
          </Pressable>
        </View>

        <View className="mt-5">
          <View className="flex-row items-center gap-2">
            <ScanText size={14} color="#4F46E5" />
            <Text className="font-inter-semibold text-[10px] uppercase tracking-[1.4px] text-ink-muted">
              Automatic text check
            </Text>
          </View>

          {ocr.status === "idle" ? (
            <Text className="mt-2 rounded-xl border border-line bg-surface-canvas p-3 font-inter text-[11px] leading-5 text-ink-muted">
              Upload an image to extract visible text with tesseract.js. PDFs are reviewed manually
              by an admin.
            </Text>
          ) : null}

          {ocr.status === "running" ? (
            <View className="mt-2 flex-row items-center gap-2 rounded-xl border border-accent-indigo/20 bg-accent-indigo-soft p-3">
              <Loader2 size={14} color="#4F46E5" />
              <Text className="font-inter-semibold text-[11px] text-accent-indigo">
                Reading the document…
              </Text>
            </View>
          ) : null}

          {ocr.status === "completed" && ocr.text ? (
            <View className="mt-2 rounded-xl border border-verified-emerald/25 bg-verified-emerald-soft/50 p-3">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="font-inter-semibold text-[11px] text-emerald-800">
                  Text extracted
                </Text>
                {ocr.confidence !== null ? (
                  <Badge tone="emerald">{ocr.confidence}% confidence</Badge>
                ) : null}
              </View>
              <Text
                numberOfLines={8}
                className="mt-2 font-inter text-[10px] leading-5 text-ink-primary/80"
              >
                {ocr.text}
              </Text>
            </View>
          ) : null}

          {ocr.status === "skipped" || ocr.status === "empty" || ocr.status === "failed" ? (
            <Alert tone={ocr.status === "failed" ? "error" : "info"} className="mt-2">
              {ocr.message ?? "Manual review will cover this document."}
            </Alert>
          ) : null}
        </View>

        <View className="mt-4 flex-row items-start gap-2 rounded-xl border border-line bg-surface-canvas p-3">
          <LockKeyhole size={14} color="#10B981" style={{ marginTop: 2 }} />
          <Text className="flex-1 font-inter text-[10px] leading-5 text-ink-muted">
            Certificates are visible only to you and the review team. Employers need an unlock
            before a signed 5-minute link is issued.
          </Text>
        </View>
      </Card>

      {/* ── Pitch ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="2. Live pitch"
          description="Camera only. Recording stops automatically at 02:00."
          action={
            <Badge tone={recording ? "danger" : video.uri ? "emerald" : "neutral"}>
              {recording ? "Recording" : video.uri ? "Recorded" : "Ready"}
            </Badge>
          }
        />

        {!permissionsGranted ? (
          <View className="mt-4 gap-3 rounded-xl border border-line bg-surface-canvas p-4">
            <View className="flex-row items-center gap-2">
              <Camera size={16} color="#4F46E5" />
              <Text className="font-inter-semibold text-[12px] text-brand-navy">
                Camera and microphone access
              </Text>
            </View>
            <Text className="font-inter text-[11px] leading-5 text-ink-muted">
              The live pitch records from your front camera with audio. Gallery uploads are disabled
              by design.
            </Text>
            <Button
              label="Allow camera and microphone"
              size="sm"
              className="self-start"
              onPress={() => {
                void (async () => {
                  await requestCameraPermission();
                  await requestMicrophonePermission();
                })();
              }}
            />
          </View>
        ) : null}

        <View className="mt-4 overflow-hidden rounded-2xl" style={styles.studio}>
          <View className="flex-row items-center justify-between border-b border-white/10 px-4 py-2.5">
            <View className="flex-row items-center gap-2">
              <Camera size={13} color="rgba(255,255,255,0.6)" />
              <Text className="font-inter-semibold text-[10px] text-white/60">Front camera</Text>
            </View>
            <Text
              className={cn(
                "font-inter-semibold text-[13px]",
                elapsed >= MIN_PITCH_SECONDS ? "text-verified-emerald" : "text-white/60",
              )}
            >
              {formatPitchDuration(elapsed)} / {formatPitchDuration(MAX_PITCH_SECONDS)}
            </Text>
          </View>

          <View style={styles.stage}>
            {video.uri ? (
              <Video
                source={{ uri: video.uri }}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                style={StyleSheet.absoluteFill}
              />
            ) : permissionsGranted ? (
              <CameraView
                ref={cameraRef}
                facing="front"
                mode="video"
                mute={false}
                onCameraReady={() => setCameraReady(true)}
                onMountError={(event) => setRecorderError(event.message)}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <View className="flex-1 items-center justify-center gap-3 p-6">
                <View className="h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
                  <VideoIcon size={28} color="rgba(255,255,255,0.4)" />
                </View>
                <Text className="text-center font-inter text-[11px] leading-5 text-white/45">
                  Allow camera access to see your preview. Gallery uploads are disabled by design.
                </Text>
              </View>
            )}

            {!video.uri && permissionsGranted ? (
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <View className="absolute inset-6 rounded-2xl border border-white/[0.08]" />

                {recording && showCues ? (
                  <View className="absolute inset-x-4 top-4 rounded-xl border border-white/10 bg-black/40 p-3">
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="font-inter-semibold text-[8px] uppercase tracking-[1.6px] text-white/45">
                        Teleprompter · {cue?.title ?? "Cue"}
                      </Text>
                      <Text className="font-inter text-[9px] text-white/40">
                        {TELEPROMPTER_CUES.findIndex((item) => item.id === cue?.id) + 1}/
                        {TELEPROMPTER_CUES.length}
                      </Text>
                    </View>
                    <Text className="mt-1 font-inter text-[10px] leading-4 text-white/80">
                      {cue?.prompt ?? ""}
                    </Text>
                  </View>
                ) : null}

                {recording ? (
                  <View className="absolute inset-x-4 bottom-4">
                    <View className="h-1.5 overflow-hidden rounded-full bg-white/15">
                      <View
                        className="h-full rounded-full bg-verified-emerald"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </View>
                    <Text className="mt-1.5 text-center font-inter text-[9px] text-white/55">
                      {elapsed < MIN_PITCH_SECONDS
                        ? `${MIN_PITCH_SECONDS - elapsed}s until Submit unlocks`
                        : "Submit unlocked — stop whenever you are ready"}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        {recorderError ? (
          <Alert tone="error" className="mt-3">
            {recorderError}
          </Alert>
        ) : null}

        <View className="mt-4">
          {!video.uri ? (
            <View className="flex-row flex-wrap items-center gap-2">
              {!recording ? (
                <Button
                  label={cameraReady ? "Start recording" : "Starting camera…"}
                  disabled={
                    certificate.status !== "uploaded" || !cameraReady || !permissionsGranted
                  }
                  icon={<Play size={15} color="#FFFFFF" />}
                  onPress={() => void startRecording()}
                />
              ) : (
                <Button
                  label={`Stop at ${formatPitchDuration(elapsed)}`}
                  variant="danger"
                  disabled={elapsed < MIN_PITCH_SECONDS}
                  icon={<Square size={14} color="#FFFFFF" />}
                  onPress={stopRecording}
                />
              )}
              <Button
                label={showCues ? "Hide cues" : "Show cues"}
                size="sm"
                variant="secondary"
                disabled={!recording}
                onPress={() => setShowCues((current) => !current)}
              />
            </View>
          ) : (
            <View className="flex-row flex-wrap items-center gap-2">
              <Badge tone="emerald" icon={<CheckCircle2 size={11} color="#10B981" />}>
                {formatPitchDuration(video.durationSeconds)} recorded
              </Badge>
              <Button
                label="Re-record"
                size="sm"
                variant="secondary"
                icon={<RotateCcw size={14} color="#0F172A" />}
                onPress={discardRecording}
              />
            </View>
          )}

          {!recording && !video.uri && certificate.status !== "uploaded" ? (
            <Text className="mt-2 font-inter text-[10px] text-ink-muted">
              Upload your certificate first. The pitch recorder unlocks after that.
            </Text>
          ) : null}
        </View>

        <View className="mt-4 rounded-xl border border-line bg-surface-canvas p-3">
          <View className="flex-row items-center gap-1.5">
            <FileText size={13} color="#4F46E5" />
            <Text className="font-inter-semibold text-[11px] text-brand-navy">What to cover</Text>
          </View>
          <View className="mt-2 gap-1.5">
            {TELEPROMPTER_CUES.map((item) => (
              <View key={item.id} className="flex-row gap-2">
                <Text className="font-inter text-[9px] text-ink-muted/70">
                  {formatPitchDuration(item.startSeconds)}
                </Text>
                <Text className="flex-1 font-inter text-[10px] leading-5 text-ink-muted">
                  <Text className="font-inter-semibold text-brand-navy">{item.title}: </Text>
                  {item.prompt}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Card>

      {/* ── Submission gates ─────────────────────────────────────────────── */}
      <Card
        className={cn(
          "flex-row flex-wrap items-center justify-between gap-3",
          canFinalize ? "border-verified-emerald/30" : undefined,
        )}
      >
        <View className="flex-row items-start gap-2.5">
          <View
            className={cn(
              "h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              canFinalize ? "bg-verified-emerald-soft" : "bg-surface-muted",
            )}
          >
            {canFinalize ? (
              <CheckCircle2 size={19} color="#10B981" />
            ) : (
              <AlertTriangle size={19} color="#64748B" />
            )}
          </View>
          <View className="flex-1">
            <Text className="font-inter-semibold text-[12px] text-brand-navy">
              {canFinalize ? "Everything is ready" : "Submission gates"}
            </Text>
            <Text className="mt-0.5 font-inter text-[10px] leading-5 text-ink-muted">
              Certificate uploaded · pitch{" "}
              {video.durationSeconds ? formatPitchDuration(video.durationSeconds) : "not recorded"}{" "}
              ·{" "}
              {video.durationSeconds >= MIN_PITCH_SECONDS
                ? "60s minimum met"
                : `${MIN_PITCH_SECONDS}s minimum not met`}{" "}
              · {registrarConsent ? "registrar consent recorded" : "registrar consent required"}
            </Text>
          </View>
        </View>
        <Button
          label="Submit for review"
          disabled={!canFinalize}
          loading={submitting}
          onPress={() => void submitForReview()}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  studio: {
    backgroundColor: "#090D16",
  },
  stage: {
    aspectRatio: 3 / 4,
    backgroundColor: "#111827",
  },
});
