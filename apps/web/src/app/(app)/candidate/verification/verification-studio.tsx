"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Camera,
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
  Video,
} from "lucide-react";
import {
  MAX_PITCH_SECONDS,
  MAX_UPLOAD_BYTES,
  MIN_PITCH_SECONDS,
  PITCH_VIDEO_SPEC,
  PREFERRED_RECORDING_MIME_TYPES,
  TELEPROMPTER_CUES,
  formatBytes,
  formatPitchDuration,
  getPitchProgress,
  getTeleprompterCue,
  pickSupportedRecordingMime,
  type PresignUploadResponse,
} from "@utn/shared";
import { authFetch, readApiError } from "@/lib/api/client";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CertificateState = {
  status: "idle" | "uploading" | "uploaded" | "error";
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
  blob: Blob | null;
  url: string | null;
  durationSeconds: number;
  mimeType: string;
  uploadStatus: "idle" | "uploading" | "uploaded";
  key: string | null;
  error: string | null;
};

const ACCEPTED_CERTIFICATE_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

function normalizeMime(value: string): string {
  return value.split(";")[0]?.trim().toLowerCase() ?? "";
}

function certificateType(file: File): string | null {
  const direct = normalizeMime(file.type);
  if ((ACCEPTED_CERTIFICATE_TYPES as readonly string[]).includes(direct)) return direct;
  const name = file.name.toLowerCase();
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
  return {
    blob: null,
    url: null,
    durationSeconds: 0,
    mimeType: "",
    uploadStatus: "idle",
    key: null,
    error: null,
  };
}

export function VerificationStudio() {
  const router = useRouter();

  const [certificate, setCertificate] = useState<CertificateState>(initialCertificate);
  const [ocr, setOcr] = useState<OcrState>(initialOcr);
  const [video, setVideo] = useState<VideoState>(initialVideo);

  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recorderError, setRecorderError] = useState<string | null>(null);
  const [showCues, setShowCues] = useState(true);

  const [verificationRef, setVerificationRef] = useState("");
  const [registrarConsent, setRegistrarConsent] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const cameraRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const elapsedRef = useRef(0);
  const stopRequestedRef = useRef(false);
  const finalDurationRef = useRef(0);
  const intervalRef = useRef<number | null>(null);

  const cue = useMemo(() => getTeleprompterCue(elapsed), [elapsed]);
  const progress = getPitchProgress(elapsed);
  const canFinalize =
    certificate.status === "uploaded" &&
    Boolean(certificate.key) &&
    Boolean(video.blob) &&
    video.durationSeconds >= MIN_PITCH_SECONDS &&
    registrarConsent &&
    !submitting;
  const cameraSupported =
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined";

  // Attach the live stream once React has rendered the <video> element.
  useEffect(() => {
    const element = cameraRef.current;
    if (!element || !stream) return;
    element.srcObject = stream;
    element.play().catch(() => undefined);
  }, [stream, cameraActive]);

  const cleanupStream = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  useEffect(() => {
    return () => {
      cleanupStream();
      if (video.url) URL.revokeObjectURL(video.url);
    };
    // Only revoke the URL that existed at unmount time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Certificate upload + OCR ───────────────────────────────────────────────

  async function handleCertificate(file: File) {
    setSubmitError(null);
    const contentType = certificateType(file);
    const maxUploadBytes = MAX_UPLOAD_BYTES["private-credentials"];

    if (!contentType) {
      setCertificate({
        ...initialCertificate(),
        status: "error",
        message: "Use a PDF, JPG, or PNG file.",
      });
      setOcr(initialOcr());
      return;
    }

    if (file.size > maxUploadBytes) {
      setCertificate({
        ...initialCertificate(),
        status: "error",
        message: `That file is ${formatBytes(file.size)}. The maximum is ${formatBytes(maxUploadBytes)}.`,
      });
      setOcr(initialOcr());
      return;
    }

    setOcr(initialOcr());
    setCertificate({
      status: "uploading",
      key: null,
      contentType,
      sizeBytes: file.size,
      fileName: file.name,
      message: null,
    });

    try {
      const response = await authFetch("/api/storage/presign", {
        method: "POST",
        body: JSON.stringify({
          intent: "upload",
          bucket: "private-credentials",
          contentType,
          contentLength: file.size,
          fileName: file.name,
        }),
      });

      if (!response.ok) throw new Error(await readApiError(response));
      const presigned = (await response.json()) as PresignUploadResponse;

      // Content-Length is a forbidden browser header; fetch derives it from the
      // File body, which matches the length we signed.
      const upload = await fetch(presigned.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });

      if (!upload.ok) {
        throw new Error("The secure upload failed. Check your connection and try again.");
      }

      setCertificate((current) => ({
        ...current,
        status: "uploaded",
        key: presigned.key,
        message: null,
      }));

      setOcr({ status: "running", text: null, message: null, confidence: null });

      const ocrResponse = await authFetch("/api/verification/ocr", {
        method: "POST",
        body: JSON.stringify({ certificateR2Key: presigned.key }),
      });

      if (!ocrResponse.ok) {
        setOcr({
          status: "failed",
          text: null,
          message: await readApiError(ocrResponse),
          confidence: null,
        });
        return;
      }

      const result = (await ocrResponse.json()) as {
        status: "completed" | "skipped" | "empty";
        text?: string;
        message?: string;
        confidence?: number;
        reason?: string;
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
      setCertificate((current) => ({
        ...current,
        status: "error",
        key: null,
        message: error instanceof Error ? error.message : "The upload failed.",
      }));
      setOcr(initialOcr());
    }
  }

  // ── Camera recording ───────────────────────────────────────────────────────

  const stopRecording = useCallback(() => {
    if (stopRequestedRef.current) return;
    stopRequestedRef.current = true;

    const finalElapsed = Math.min(
      MAX_PITCH_SECONDS,
      Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000)),
    );
    finalDurationRef.current = finalElapsed;
    elapsedRef.current = finalElapsed;
    setElapsed(finalElapsed);
    setRecording(false);

    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      cleanupStream();
    }
  }, [cleanupStream]);

  async function startRecording() {
    setRecorderError(null);
    setSubmitError(null);

    if (!cameraSupported) {
      setRecorderError(
        "This browser cannot record video. Use a recent Chrome, Edge, Safari, or Firefox over HTTPS.",
      );
      return;
    }

    if (video.url) URL.revokeObjectURL(video.url);
    setVideo(initialVideo());
    setElapsed(0);
    elapsedRef.current = 0;
    stopRequestedRef.current = false;
    chunksRef.current = [];

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: PITCH_VIDEO_SPEC.width },
          height: { ideal: PITCH_VIDEO_SPEC.height },
          frameRate: { ideal: PITCH_VIDEO_SPEC.frameRate },
          facingMode: "user",
        },
        audio: true,
      });

      const mimeType = pickSupportedRecordingMime(
        (candidate) => MediaRecorder.isTypeSupported(candidate),
        PREFERRED_RECORDING_MIME_TYPES,
      );

      if (!mimeType) {
        mediaStream.getTracks().forEach((track) => track.stop());
        setRecorderError("No supported recording format was found in this browser.");
        return;
      }

      const recorder = new MediaRecorder(mediaStream, {
        mimeType,
        videoBitsPerSecond: PITCH_VIDEO_SPEC.videoBitsPerSecond,
      });

      streamRef.current = mediaStream;
      recorderRef.current = recorder;
      setStream(mediaStream);
      setCameraActive(true);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const baseType = normalizeMime(mimeType);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        cleanupStream();
        setCameraActive(false);
        setVideo({
          blob,
          url: URL.createObjectURL(blob),
          durationSeconds: finalDurationRef.current,
          mimeType: baseType,
          uploadStatus: "idle",
          key: null,
          error: null,
        });
        setRecording(false);
      };

      recorder.start(250);
      startedAtRef.current = Date.now();
      setRecording(true);

      intervalRef.current = window.setInterval(() => {
        const seconds = Math.min(
          MAX_PITCH_SECONDS,
          Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)),
        );
        elapsedRef.current = seconds;
        setElapsed(seconds);

        if (seconds >= MAX_PITCH_SECONDS) {
          stopRecording();
        }
      }, 200);
    } catch (error) {
      cleanupStream();
      setCameraActive(false);
      const message =
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Camera and microphone access was denied. Allow both permissions to record your pitch."
          : error instanceof Error
            ? error.message
            : "Could not start the camera.";
      setRecorderError(message);
    }
  }

  function discardRecording() {
    if (video.url) URL.revokeObjectURL(video.url);
    setVideo(initialVideo());
    setElapsed(0);
    elapsedRef.current = 0;
    setRecorderError(null);
  }

  // ── Final submission ───────────────────────────────────────────────────────

  async function submitForReview() {
    if (!certificate.key || !video.blob) return;
    if (!registrarConsent) {
      setSubmitError(
        "Confirm the certificate is authentic and authorize registrar verification before submitting.",
      );
      return;
    }
    setSubmitError(null);
    setSubmitting(true);

    try {
      const duration = Math.min(
        MAX_PITCH_SECONDS,
        Math.max(MIN_PITCH_SECONDS, Math.round(video.durationSeconds)),
      );

      const presignResponse = await authFetch("/api/storage/presign", {
        method: "POST",
        body: JSON.stringify({
          intent: "upload",
          bucket: "pitch-videos",
          contentType: video.mimeType,
          contentLength: video.blob.size,
          fileName: `pitch.${video.mimeType === "video/mp4" ? "mp4" : "webm"}`,
          videoDurationSeconds: duration,
        }),
      });

      if (!presignResponse.ok) throw new Error(await readApiError(presignResponse));
      const presigned = (await presignResponse.json()) as PresignUploadResponse;

      setVideo((current) => ({ ...current, uploadStatus: "uploading" }));

      const upload = await fetch(presigned.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": video.mimeType },
        body: video.blob,
      });

      if (!upload.ok) {
        throw new Error("Your pitch upload did not complete. Try again on a stable connection.");
      }

      setVideo((current) => ({
        ...current,
        uploadStatus: "uploaded",
        key: presigned.key,
      }));

      const finalizeResponse = await authFetch("/api/verification/finalize", {
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
            sizeBytes: video.blob.size,
          },
          certificateVerificationRef: verificationRef.trim() || null,
          registrarConsentGiven: true,
          registrarConsentAt: new Date().toISOString(),
        }),
      });

      if (!finalizeResponse.ok) throw new Error(await readApiError(finalizeResponse));

      setSubmitted(true);
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Submission failed.");
      setVideo((current) => ({ ...current, uploadStatus: "idle" }));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="animate-slide-in border-verified-emerald/30 bg-verified-emerald-soft/40">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 animate-check-pop place-items-center rounded-2xl bg-verified-emerald text-white">
            <CheckCircle2 className="size-6" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-2xl font-extrabold text-brand-navy">
              Submitted for review
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-ink-muted">
              Your certificate and live pitch are locked while an admin reviews them. You will see
              the decision on this page and your dashboard. Media cannot be changed during review.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="emerald">Status · Under review</Badge>
              <Badge tone="neutral">{formatPitchDuration(video.durationSeconds)}</Badge>
              <Badge tone="neutral">Camera-only pitch</Badge>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {submitError ? <Alert tone="error">{submitError}</Alert> : null}

      <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
        {/* ── Certificate ─────────────────────────────────────────────────── */}
        <Card className="h-fit">
          <CardHeader
            title="1. Private certificate"
            description="PDF, JPG, or PNG up to 10 MB. Never shown on a public URL."
          />

          <div className="mt-5">
            <label
              htmlFor="certificate"
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors duration-300",
                certificate.status === "uploaded"
                  ? "border-verified-emerald/40 bg-verified-emerald-soft/40"
                  : "border-line bg-surface-canvas hover:border-accent-emerald/40 hover:bg-accent-emerald-soft/30",
              )}
            >
              <span className="grid size-11 place-items-center rounded-xl bg-surface-card text-accent-emerald-hover shadow-sm">
                {certificate.status === "uploading" ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                ) : certificate.status === "uploaded" ? (
                  <FileCheck2 className="size-5 text-verified-emerald" aria-hidden />
                ) : (
                  <UploadCloud className="size-5" aria-hidden />
                )}
              </span>
              <span className="text-sm font-semibold text-brand-navy">
                {certificate.status === "uploaded"
                  ? certificate.fileName
                  : certificate.status === "uploading"
                    ? "Uploading securely…"
                    : "Choose your degree document"}
              </span>
              <span className="text-xs text-ink-muted">
                {certificate.status === "uploaded"
                  ? `${formatBytes(certificate.sizeBytes)} · Uploaded`
                  : "Your file goes straight to private R2 storage"}
              </span>
              <input
                id="certificate"
                type="file"
                className="sr-only"
                accept="application/pdf,image/jpeg,image/png"
                disabled={certificate.status === "uploading"}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void handleCertificate(file);
                }}
              />
            </label>

            {certificate.message ? (
              <Alert tone="error" className="mt-3">
                {certificate.message}
              </Alert>
            ) : null}

            <div className="mt-5 space-y-4">
              <Field
                label="Certificate Verification URL or Serial Number (Optional)"
                htmlFor="certificate-verification-ref"
                hint="If your digital diploma includes a QR verification link or serial number, paste it here to speed up approval."
              >
                <Input
                  id="certificate-verification-ref"
                  value={verificationRef}
                  onChange={(event) => setVerificationRef(event.target.value)}
                  placeholder="https://verify.university.edu/cert/12345 or Serial #884920"
                  maxLength={500}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>

              <div
                className={cn(
                  "rounded-xl border p-4 transition",
                  registrarConsent
                    ? "border-verified-emerald/30 bg-verified-emerald-soft/40"
                    : "border-line bg-surface-canvas",
                )}
              >
                <label
                  htmlFor="registrar-consent"
                  className="flex cursor-pointer items-start gap-3"
                >
                  <input
                    id="registrar-consent"
                    type="checkbox"
                    checked={registrarConsent}
                    onChange={(event) => setRegistrarConsent(event.target.checked)}
                    className="mt-0.5 size-4 shrink-0 cursor-pointer accent-verified-emerald"
                  />
                  <span className="text-xs leading-5 text-ink-primary">
                    I confirm this certificate is authentic and authorize University Talent Network
                    to contact my university registrar or official verification portal to confirm my
                    degree.
                  </span>
                </label>
                <p className="mt-2 pl-7 text-[11px] leading-4 text-ink-muted">
                  Required before you can submit for review.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
              <ScanText className="size-4 text-accent-emerald-hover" aria-hidden />
              Automatic text check
            </div>

            {ocr.status === "idle" ? (
              <p className="mt-2 rounded-xl border border-line bg-surface-canvas p-3 text-xs leading-5 text-ink-muted">
                Upload an image to extract visible text with tesseract.js. PDFs are reviewed
                manually by an admin.
              </p>
            ) : null}

            {ocr.status === "running" ? (
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-accent-emerald/20 bg-accent-emerald-soft p-3 text-xs font-medium text-accent-emerald-hover">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Reading the document…
              </div>
            ) : null}

            {ocr.status === "completed" && ocr.text ? (
              <div className="mt-2 rounded-xl border border-verified-emerald/25 bg-verified-emerald-soft/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-emerald-800">Text extracted</p>
                  {ocr.confidence !== null ? (
                    <Badge tone="emerald">{ocr.confidence}% confidence</Badge>
                  ) : null}
                </div>
                <p className="mt-2 max-h-36 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-5 text-ink-primary/80">
                  {ocr.text}
                </p>
              </div>
            ) : null}

            {ocr.status === "skipped" || ocr.status === "empty" || ocr.status === "failed" ? (
              <Alert tone={ocr.status === "failed" ? "error" : "info"} className="mt-2">
                {ocr.message}
              </Alert>
            ) : null}
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-xl border border-line bg-surface-canvas p-3">
            <LockKeyhole className="mt-0.5 size-4 shrink-0 text-verified-emerald" aria-hidden />
            <p className="text-[11px] leading-5 text-ink-muted">
              Certificates are visible only to you and the review team. Employers need an unlock
              before a signed 5-minute link is issued.
            </p>
          </div>
        </Card>

        {/* ── Pitch ───────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader
            title="2. Live pitch"
            description="Camera only. Recording stops automatically at 02:00."
            action={
              <Badge tone={recording ? "danger" : video.blob ? "emerald" : "neutral"}>
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    recording ? "animate-pulse bg-danger" : "bg-current",
                  )}
                  aria-hidden
                />
                {recording ? "Recording" : video.blob ? "Recorded" : "Ready"}
              </Badge>
            }
          />

          <div className="mt-4 overflow-hidden rounded-2xl bg-studio-obsidian">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-white/60">
                <Camera className="size-3.5" aria-hidden />
                Front camera · 720p
              </div>
              <span
                className={cn(
                  "font-mono text-sm font-semibold tabular-nums",
                  elapsed >= MIN_PITCH_SECONDS ? "text-verified-emerald" : "text-white/60",
                )}
              >
                {formatPitchDuration(elapsed)} / {formatPitchDuration(MAX_PITCH_SECONDS)}
              </span>
            </div>

            <div className="relative aspect-video w-full bg-[radial-gradient(circle_at_50%_20%,#1E2740_0%,#0E1424_50%,#070B16_100%)]">
              {video.url ? (
                <video
                  src={video.url}
                  controls
                  playsInline
                  className="absolute inset-0 size-full object-contain"
                />
              ) : (
                <>
                  <video
                    ref={cameraRef}
                    muted
                    playsInline
                    className={cn(
                      "absolute inset-0 size-full scale-x-[-1] object-cover",
                      cameraActive ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {!cameraActive ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                      <span className="grid size-14 place-items-center rounded-full border border-white/10 bg-white/5 text-white/60">
                        <Video className="size-7" aria-hidden />
                      </span>
                      <p className="text-xs text-white/60">
                        Your camera preview appears here. Gallery uploads are disabled by design.
                      </p>
                    </div>
                  ) : null}

                  {/* Framing guides */}
                  <div
                    className="pointer-events-none absolute inset-6 rounded-2xl border border-white/[0.08]"
                    aria-hidden
                  />
                  {[
                    "left-6 top-6 border-l border-t",
                    "right-6 top-6 border-r border-t",
                    "bottom-6 left-6 border-b border-l",
                    "bottom-6 right-6 border-b border-r",
                  ].map((position) => (
                    <span
                      key={position}
                      className={cn(
                        "pointer-events-none absolute size-5 border-white/30",
                        position,
                      )}
                      aria-hidden
                    />
                  ))}

                  {recording && showCues ? (
                    <div className="absolute inset-x-4 top-4 rounded-xl border border-white/10 bg-black/40 p-3 backdrop-blur-md">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/60">
                          Teleprompter · {cue.title}
                        </p>
                        <span className="font-mono text-[9px] text-white/60">
                          {TELEPROMPTER_CUES.findIndex((item) => item.id === cue.id) + 1}/
                          {TELEPROMPTER_CUES.length}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-4 text-white/80">{cue.prompt}</p>
                    </div>
                  ) : null}

                  {recording ? (
                    <div className="absolute inset-x-4 bottom-4">
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                        <div
                          className="h-full rounded-full bg-verified-emerald transition-[width] duration-200"
                          style={{ width: `${Math.round(progress * 100)}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-center text-[10px] font-medium text-white/55">
                        {elapsed < MIN_PITCH_SECONDS
                          ? `${MIN_PITCH_SECONDS - elapsed}s until Submit unlocks`
                          : "Submit unlocked — stop whenever you are ready"}
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {recorderError ? (
            <Alert tone="error" className="mt-3">
              {recorderError}
            </Alert>
          ) : null}

          <div className="mt-4">
            {!video.blob ? (
              <div className="flex flex-wrap items-center gap-2">
                {!recording ? (
                  <Button
                    onClick={() => void startRecording()}
                    disabled={certificate.status !== "uploaded"}
                  >
                    <Play className="size-4" aria-hidden />
                    {cameraActive ? "Restart camera" : "Start recording"}
                  </Button>
                ) : (
                  <Button
                    variant="danger"
                    onClick={stopRecording}
                    disabled={elapsed < MIN_PITCH_SECONDS}
                  >
                    <Square className="size-4" aria-hidden />
                    Stop at {formatPitchDuration(elapsed)}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowCues((current) => !current)}
                  disabled={!recording}
                >
                  {showCues ? "Hide cues" : "Show cues"}
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="emerald">
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  {formatPitchDuration(video.durationSeconds)} recorded
                </Badge>
                <Button variant="secondary" size="sm" onClick={discardRecording}>
                  <RotateCcw className="size-4" aria-hidden />
                  Re-record
                </Button>
              </div>
            )}

            {!recording && !video.blob && certificate.status !== "uploaded" ? (
              <p className="mt-2 text-xs text-ink-muted">
                Upload your certificate first. The pitch recorder unlocks after that.
              </p>
            ) : null}
          </div>

          <div className="mt-4 rounded-xl border border-line bg-surface-canvas p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-navy">
              <FileText className="size-3.5 text-accent-emerald-hover" aria-hidden />
              What to cover
            </p>
            <ol className="mt-2 space-y-1.5">
              {TELEPROMPTER_CUES.map((item) => (
                <li key={item.id} className="flex gap-2 text-[11px] leading-5 text-ink-muted">
                  <span className="font-mono text-ink-muted">
                    {formatPitchDuration(item.startSeconds)}
                  </span>
                  <span>
                    <span className="font-semibold text-brand-navy">{item.title}:</span>{" "}
                    {item.prompt}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </Card>
      </div>

      <Card
        className={cn(
          "flex flex-wrap items-center justify-between gap-4",
          canFinalize ? "border-verified-emerald/30" : undefined,
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-xl",
              canFinalize
                ? "bg-verified-emerald-soft text-verified-emerald"
                : "bg-surface-muted text-ink-muted",
            )}
          >
            {canFinalize ? (
              <CheckCircle2 className="size-5" aria-hidden />
            ) : (
              <AlertTriangle className="size-5" aria-hidden />
            )}
          </span>
          <div>
            <p className="text-sm font-semibold text-brand-navy">
              {canFinalize ? "Everything is ready" : "Submission gates"}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">
              Certificate uploaded · pitch{" "}
              {video.durationSeconds ? formatPitchDuration(video.durationSeconds) : "not recorded"}{" "}
              ·{" "}
              {video.durationSeconds >= MIN_PITCH_SECONDS
                ? "60s minimum met"
                : `${MIN_PITCH_SECONDS}s minimum not met`}{" "}
              · {registrarConsent ? "registrar consent recorded" : "registrar consent required"}
            </p>
          </div>
        </div>
        <Button
          size="lg"
          disabled={!canFinalize}
          loading={submitting}
          onClick={() => void submitForReview()}
        >
          Submit for review
        </Button>
      </Card>
    </div>
  );
}
