"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  FileText,
  Loader2,
  LockKeyhole,
  Mic,
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
  VIDEO_SESSION_QUESTION_SECONDS,
  VIDEO_SESSION_TOTAL_SECONDS,
  VIDEO_SESSION_DISPLAY_SECONDS,
  VIDEO_SESSION_ANSWER_SECONDS,
  VIDEO_SESSION_INTRO_SECONDS,
  formatBytes,
  formatPitchDuration,
  pickSupportedRecordingMime,
  type CandidateProfile,
  type PresignUploadResponse,
  type VideoSessionQuestion,
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

type CvState = {
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

type ReadinessState = {
  status: "idle" | "checking" | "ready" | "error";
  camera: string | null;
  microphone: string | null;
  message: string | null;
};

type Chapter = { index: 1 | 2 | 3 | 4; start: number; end: number };

const ACCEPTED_CERTIFICATE_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
const PER_QUESTION = VIDEO_SESSION_QUESTION_SECONDS;
const INTRO = VIDEO_SESSION_INTRO_SECONDS;
const DISPLAY = VIDEO_SESSION_DISPLAY_SECONDS;
const ANSWER = VIDEO_SESSION_ANSWER_SECONDS;
const TOTAL_BUDGET = VIDEO_SESSION_TOTAL_SECONDS;

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
  return { status: "idle", key: null, contentType: "", sizeBytes: 0, fileName: "", message: null };
}
function initialCv(): CvState {
  return { status: "idle", key: null, contentType: "", sizeBytes: 0, fileName: "", message: null };
}
function initialOcr(): OcrState {
  return { status: "idle", text: null, message: null, confidence: null };
}
function initialVideo(): VideoState {
  return { blob: null, url: null, durationSeconds: 0, mimeType: "", uploadStatus: "idle", key: null, error: null };
}
function initialReadiness(): ReadinessState {
  return { status: "idle", camera: null, microphone: null, message: null };
}

export function VerificationStudio({
  profile,
  initialQuestions,
}: {
  profile?: CandidateProfile | null;
  initialQuestions?: VideoSessionQuestion[] | null;
}) {
  const router = useRouter();

  const [certificate, setCertificate] = useState<CertificateState>(initialCertificate());
  const [cv, setCv] = useState<CvState>(initialCv());
  const [ocr, setOcr] = useState<OcrState>(initialOcr);
  const [video, setVideo] = useState<VideoState>(initialVideo);

  const [questions, setQuestions] = useState<VideoSessionQuestion[] | null>(initialQuestions ?? null);
  const [questionsStatus, setQuestionsStatus] = useState<"idle" | "generating" | "ready" | "error">(
    initialQuestions && initialQuestions.length === 4 ? "ready" : "idle",
  );
  const [questionsError, setQuestionsError] = useState<string | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [sessionPhase, setSessionPhase] = useState<"idle" | "ready" | "active" | "between" | "complete">("idle");
  const [questionPhase, setQuestionPhase] = useState<"intro" | "display" | "answer">("intro");
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [questionElapsed, setQuestionElapsed] = useState(0);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [recorderError, setRecorderError] = useState<string | null>(null);

  const [verificationRef, setVerificationRef] = useState("");
  const [registrarConsent, setRegistrarConsent] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [readiness, setReadiness] = useState<ReadinessState>(initialReadiness);

  const cameraRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedTotalRef = useRef(0);
  const questionStartRef = useRef(0);
  const questionStartedAtRef = useRef(0);
  const intervalRef = useRef<number | null>(null);

  const profileComplete =
    Boolean(profile?.university_name) &&
    Boolean(profile?.major_specialization) &&
    Boolean(profile?.graduation_year);

  const studioSteps = [
    { id: 1, label: "University Details", hint: "Profile & major", done: profileComplete },
    { id: 2, label: "Degree Upload", hint: "Private certificate", done: certificate.status === "uploaded" && Boolean(certificate.key) },
    { id: 3, label: "Assessment Questions", hint: "4 tailored questions", done: questionsStatus === "ready" && Boolean(questions?.length) },
    { id: 4, label: "4-Question Session", hint: "120s recorded", done: Boolean(video.blob) && chapters.length === 4 },
  ];
  const activeStep = studioSteps.findIndex((s) => !s.done);

  // Attach stream
  useEffect(() => {
    const element = cameraRef.current;
    if (!element || !stream) return;
    element.srcObject = stream;
    element.play().catch(() => undefined);
  }, [stream, cameraActive]);

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (video.url) URL.revokeObjectURL(video.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Certificate upload + OCR ───────────────────────────────────────────────
  async function handleCertificate(file: File) {
    setSubmitError(null);
    const contentType = certificateType(file);
    const maxUploadBytes = MAX_UPLOAD_BYTES["private-credentials"];

    if (!contentType) {
      setCertificate({ ...initialCertificate(), status: "error", message: "Use a PDF, JPG, or PNG file." });
      setOcr(initialOcr());
      return;
    }
    if (file.size > maxUploadBytes) {
      setCertificate({ ...initialCertificate(), status: "error", message: `That file is ${formatBytes(file.size)}. Max is ${formatBytes(maxUploadBytes)}.` });
      setOcr(initialOcr());
      return;
    }

    setOcr(initialOcr());
    setCertificate({ status: "uploading", key: null, contentType, sizeBytes: file.size, fileName: file.name, message: null });

    try {
      const response = await authFetch("/api/storage/presign", {
        method: "POST",
        body: JSON.stringify({ intent: "upload", bucket: "private-credentials", contentType, contentLength: file.size, fileName: file.name }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const presigned = (await response.json()) as PresignUploadResponse;

      const upload = await fetch(presigned.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!upload.ok) throw new Error("The secure upload failed. Check your connection and try again.");

      setCertificate((c) => ({ ...c, status: "uploaded", key: presigned.key, message: null }));
      setOcr({ status: "running", text: null, message: null, confidence: null });

      const ocrResponse = await authFetch("/api/verification/ocr", {
        method: "POST",
        body: JSON.stringify({ certificateR2Key: presigned.key }),
      });

      if (!ocrResponse.ok) {
        setOcr({ status: "failed", text: null, message: await readApiError(ocrResponse), confidence: null });
      } else {
        const result = (await ocrResponse.json()) as { status: "completed" | "skipped" | "empty"; text?: string; message?: string; confidence?: number };
        if (result.status === "completed" && result.text) {
          setOcr({ status: "completed", text: result.text, message: null, confidence: result.confidence ?? null });
        } else if (result.status === "skipped") {
          setOcr({ status: "skipped", text: null, message: result.message ?? "PDF received. An admin will read this document manually.", confidence: null });
        } else {
          setOcr({ status: "empty", text: null, message: result.message ?? "No readable text found. An admin will review manually.", confidence: null });
        }
      }

      // Trigger question generation after certificate upload settles.
      void generateQuestions();
    } catch (error) {
      setCertificate((c) => ({ ...c, status: "error", key: null, message: error instanceof Error ? error.message : "The upload failed." }));
      setOcr(initialOcr());
    }
  }

  async function handleCv(file: File) {
    setSubmitError(null);
    const contentType = "application/pdf";
    const maxUploadBytes = MAX_UPLOAD_BYTES["private-credentials"];
    if (file.type && normalizeMime(file.type) !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setCv({ ...initialCv(), status: "error", message: "Use a PDF file." });
      return;
    }
    if (file.size > maxUploadBytes) {
      setCv({ ...initialCv(), status: "error", message: `That file is ${formatBytes(file.size)}. Max is ${formatBytes(maxUploadBytes)}.` });
      return;
    }

    setCv({ status: "uploading", key: null, contentType, sizeBytes: file.size, fileName: file.name, message: null });

    try {
      const response = await authFetch("/api/storage/presign", {
        method: "POST",
        body: JSON.stringify({ intent: "upload", bucket: "private-credentials", contentType, contentLength: file.size, fileName: file.name }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const presigned = (await response.json()) as PresignUploadResponse;

      const upload = await fetch(presigned.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!upload.ok) throw new Error("The secure upload failed. Check your connection and try again.");

      setCv((c: CvState) => ({ ...c, status: "uploaded", key: presigned.key, message: null }));
    } catch (error) {
      setCv((c: CvState) => ({ ...c, status: "error", key: null, message: error instanceof Error ? error.message : "The upload failed." }));
    }
  }

  async function generateQuestions() {
    if (questionsStatus === "generating") return;
    setQuestionsStatus("generating");
    setQuestionsError(null);
    try {
      const res = await authFetch("/api/candidate/generate-questions", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(await readApiError(res));
      const body = (await res.json()) as { questions: VideoSessionQuestion[] };
      setQuestions(body.questions);
      setQuestionsStatus("ready");
    } catch (error) {
      setQuestionsStatus("error");
      setQuestionsError(error instanceof Error ? error.message : "Could not generate questions.");
    }
  }

  // ── Camera + recording ──────────────────────────────────────────────────────
  async function checkReadiness() {
    setReadiness({ status: "checking", camera: null, microphone: null, message: null });
    if (!navigator.mediaDevices?.getUserMedia) {
      setReadiness({ status: "error", camera: null, microphone: null, message: "This browser cannot reach your camera or microphone." });
      return;
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: PITCH_VIDEO_SPEC.width }, height: { ideal: PITCH_VIDEO_SPEC.height }, frameRate: { ideal: PITCH_VIDEO_SPEC.frameRate }, facingMode: "user" },
        audio: true,
      });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const camera = devices.find((d) => d.kind === "videoinput")?.label;
      const microphone = devices.find((d) => d.kind === "audioinput")?.label;
      // Keep the stream alive so the live preview renders immediately.
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setCameraActive(true);
      setReadiness({ status: "ready", camera: camera || "Camera ready", microphone: microphone || "Microphone ready", message: null });
    } catch (error) {
      const denied = error instanceof DOMException && error.name === "NotAllowedError";
      setReadiness({ status: "error", camera: null, microphone: null, message: denied ? "Camera or microphone access is blocked." : "Could not reach your camera or microphone." });
    }
  }

  const cleanupStream = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const stopQuestionTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  async function beginSession() {
    setRecorderError(null);
    setSubmitError(null);
    if (!cameraSupported) {
      setRecorderError("This browser cannot record video.");
      return;
    }
    try {
      let mediaStream = streamRef.current;
      if (!mediaStream || !mediaStream.active) {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: PITCH_VIDEO_SPEC.width }, height: { ideal: PITCH_VIDEO_SPEC.height }, frameRate: { ideal: PITCH_VIDEO_SPEC.frameRate }, facingMode: "user" },
          audio: true,
        });
        streamRef.current = mediaStream;
        setStream(mediaStream);
      }
      setCameraActive(true);
      recordedTotalRef.current = 0;
      setChapters([]);
      setVideo(initialVideo());
      setSessionPhase("ready");
      setActiveQuestion(0);
    } catch (error) {
      cleanupStream();
      setCameraActive(false);
      const message = error instanceof DOMException && error.name === "NotAllowedError" ? "Camera and microphone access was denied." : error instanceof Error ? error.message : "Could not start the camera.";
      setRecorderError(message);
    }
  }

  function startQuestion(i: number) {
    if (i < 0 || i > 3) return;
    setRecorderError(null);

    if (!recorderRef.current) {
      const mediaStream = streamRef.current;
      if (!mediaStream) return;
      const mimeType = pickSupportedRecordingMime((c) => MediaRecorder.isTypeSupported(c), PREFERRED_RECORDING_MIME_TYPES);
      if (!mimeType) {
        setRecorderError("No supported recording format was found.");
        return;
      }
      const recorder = new MediaRecorder(mediaStream, { mimeType, videoBitsPerSecond: PITCH_VIDEO_SPEC.videoBitsPerSecond });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        cleanupStream();
        setCameraActive(false);
        setVideo({ blob, url: URL.createObjectURL(blob), durationSeconds: Math.round(recordedTotalRef.current), mimeType: normalizeMime(mimeType), uploadStatus: "idle", key: null, error: null });
        setSessionPhase("complete");
        setRecording(false);
      };
      recorderRef.current = recorder;
      recorder.start(250);
    } else {
      try {
        recorderRef.current.resume();
      } catch {
        /* ignore */
      }
    }

    questionStartRef.current = recordedTotalRef.current;
    questionStartedAtRef.current = Date.now();
    setActiveQuestion(i);
    setQuestionElapsed(0);
    setSessionPhase("active");
    setRecording(true);

    // Phase boundaries within this question.
    const introEnd = i === 0 ? INTRO : 0;
    const displayEnd = introEnd + DISPLAY;
    const answerEnd = displayEnd + ANSWER;
    const totalQ = answerEnd;

    if (i === 0) setQuestionPhase("intro");
    else setQuestionPhase("display");

    intervalRef.current = window.setInterval(() => {
      const seconds = Math.max(0, Math.floor((Date.now() - questionStartedAtRef.current) / 1000));
      setQuestionElapsed(seconds);
      recordedTotalRef.current = questionStartRef.current + seconds;

      if (seconds < introEnd) {
        setQuestionPhase("intro");
      } else if (seconds < displayEnd) {
        setQuestionPhase("display");
      } else if (seconds < answerEnd) {
        setQuestionPhase("answer");
      } else {
        finishQuestion(i);
      }
    }, 200);
  }

  function finishQuestion(i: number) {
    stopQuestionTimer();
    const elapsed = Math.max(1, Math.floor((Date.now() - questionStartedAtRef.current) / 1000));
    recordedTotalRef.current = questionStartRef.current + elapsed;
    const endOffset = Math.min(TOTAL_BUDGET, recordedTotalRef.current);
    const startOffset = questionStartRef.current;
    setChapters((prev) => {
      const next = prev.filter((c) => c.index !== (i + 1) as 1 | 2 | 3 | 4);
      next.push({ index: (i + 1) as 1 | 2 | 3 | 4, start: startOffset, end: endOffset });
      return next.sort((a, b) => a.index - b.index);
    });

    if (i < 3) {
      try {
        recorderRef.current?.pause();
      } catch {
        /* ignore */
      }
      setRecording(false);
      setSessionPhase("between");
      setActiveQuestion(i + 1);
    } else {
      try {
        recorderRef.current?.stop();
      } catch {
        /* ignore */
      }
    }
  }

  function discardSession() {
    if (video.url) URL.revokeObjectURL(video.url);
    try {
      recorderRef.current?.stop();
    } catch {
      /* ignore */
    }
    recorderRef.current = null;
    chunksRef.current = [];
    cleanupStream();
    setCameraActive(false);
    setVideo(initialVideo());
    setChapters([]);
    recordedTotalRef.current = 0;
    setSessionPhase("idle");
    setActiveQuestion(0);
    setQuestionElapsed(0);
    setRecording(false);
    setRecorderError(null);
  }

  // Fix: track question start timestamp properly
  // (We'll store in a ref instead of deriving)
  // Rework startQuestion to store start timestamp:
  // (already using questionStartRef as seconds offset; need wall-clock start)
  // Let's add a ref for wall clock:
  // (handled by storing in a module-level ref below via useEffect? Instead patch:)

  const cameraSupported =
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined";

  const canFinalize =
    certificate.status === "uploaded" &&
    Boolean(certificate.key) &&
    questionsStatus === "ready" &&
    Boolean(questions?.length) &&
    Boolean(video.blob) &&
    chapters.length === 4 &&
    video.durationSeconds >= MIN_PITCH_SECONDS &&
    registrarConsent &&
    !submitting;

  async function submitForReview() {
    if (!certificate.key || !video.blob || chapters.length !== 4 || !questions) return;
    if (!registrarConsent) {
      setSubmitError("Confirm the certificate is authentic and authorize registrar verification before submitting.");
      return;
    }
    const total = Math.min(TOTAL_BUDGET, Math.max(MIN_PITCH_SECONDS, Math.round(video.durationSeconds)));
    setSubmitError(null);
    setSubmitting(true);
    try {
      const presignResponse = await authFetch("/api/storage/presign", {
        method: "POST",
        body: JSON.stringify({
          intent: "upload",
          bucket: "pitch-videos",
          contentType: video.mimeType,
          contentLength: video.blob.size,
          fileName: `pitch.${video.mimeType === "video/mp4" ? "mp4" : "webm"}`,
          videoDurationSeconds: total,
        }),
      });
      if (!presignResponse.ok) throw new Error(await readApiError(presignResponse));
      const presigned = (await presignResponse.json()) as PresignUploadResponse;
      setVideo((c) => ({ ...c, uploadStatus: "uploading" }));

      const upload = await fetch(presigned.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": video.mimeType },
        body: video.blob,
      });
      if (!upload.ok) throw new Error("Your pitch upload did not complete. Try again on a stable connection.");

      setVideo((c) => ({ ...c, uploadStatus: "uploaded", key: presigned.key }));

      const sessionQuestions: VideoSessionQuestion[] = questions.map((q, i) => {
        const ch = chapters.find((c) => c.index === q.index) ?? chapters[i]!;
        return {
          index: q.index,
          question_text: q.question_text,
          allocated_seconds: q.allocated_seconds,
          start_offset_seconds: ch.start,
          end_offset_seconds: ch.end,
        };
      });

      const finalizeResponse = await authFetch("/api/verification/finalize", {
        method: "POST",
        body: JSON.stringify({
          certificate: { r2Key: certificate.key, contentType: certificate.contentType, sizeBytes: certificate.sizeBytes },
          cv: cv.key
            ? { r2Key: cv.key, contentType: "application/pdf", sizeBytes: cv.sizeBytes }
            : undefined,
          video: { r2Key: presigned.key, durationSeconds: total, contentType: video.mimeType, sizeBytes: video.blob.size },
          videoSessionQuestions: sessionQuestions,
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
      setVideo((c) => ({ ...c, uploadStatus: "idle" }));
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
            <h2 className="font-display text-2xl font-extrabold text-brand-navy">Submitted for review</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-ink-muted">
              Your certificate and 4-question assessment are locked while an admin reviews them.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="emerald">Status · Under review</Badge>
              <Badge tone="neutral">{formatPitchDuration(video.durationSeconds)}</Badge>
              <Badge tone="neutral">4-question session</Badge>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // ── recording timing refs fix: track wall-clock start per question ──────────
  // We store the wall-clock start in a ref keyed to the active question.
  // Implemented via a ref that is set in startQuestion.

  return (
    <div className="space-y-5">
      {submitError ? <Alert tone="error">{submitError}</Alert> : null}

      <Card className="p-4 sm:p-5">
        <ol className="grid gap-2 sm:grid-cols-4" aria-label="Verification progress">
          {studioSteps.map((step, index) => {
            const state = step.done ? "done" : index === activeStep ? "current" : "upcoming";
            return (
              <li key={step.id} aria-current={state === "current" ? "step" : undefined} className={cn("flex items-start gap-3 rounded-xl border p-3", state === "done" && "border-verified-emerald/30 bg-verified-emerald-soft/40", state === "current" && "border-accent-emerald/35 bg-accent-emerald-soft/50", state === "upcoming" && "border-line bg-surface-canvas")}>
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full border text-xs font-bold", state === "done" && "border-verified-emerald bg-verified-emerald text-white", state === "current" && "border-accent-emerald/40 bg-surface-card text-accent-emerald-hover", state === "upcoming" && "border-line bg-surface-card text-ink-muted")}>
                  {step.done ? <CheckCircle2 className="size-4" aria-hidden /> : step.id}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-brand-navy">{step.label}</span>
                  <span className="mt-0.5 block text-[11px] text-ink-muted">{state === "done" ? "Complete" : step.hint}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
        {/* Certificate */}
        <Card className="h-fit">
          <CardHeader title="1. Private certificate" description="PDF, JPG, or PNG up to 10 MB." />
          <div className="mt-5">
            <label htmlFor="certificate" className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors duration-300", certificate.status === "uploaded" ? "border-verified-emerald/40 bg-verified-emerald-soft/40" : "border-line bg-surface-canvas hover:border-accent-emerald/40 hover:bg-accent-emerald-soft/30")}>
              <span className="grid size-11 place-items-center rounded-xl bg-surface-card text-accent-emerald-hover shadow-sm">
                {certificate.status === "uploading" ? <Loader2 className="size-5 animate-spin" aria-hidden /> : certificate.status === "uploaded" ? <FileCheck2 className="size-5 text-verified-emerald" aria-hidden /> : <UploadCloud className="size-5" aria-hidden />}
              </span>
              <span className="text-sm font-semibold text-brand-navy">{certificate.status === "uploaded" ? certificate.fileName : certificate.status === "uploading" ? "Uploading securely…" : "Choose your degree document"}</span>
              <span className="text-xs text-ink-muted">{certificate.status === "uploaded" ? `${formatBytes(certificate.sizeBytes)} · Uploaded` : "Your file goes straight to private R2 storage"}</span>
              <input id="certificate" type="file" className="sr-only" accept="application/pdf,image/jpeg,image/png" disabled={certificate.status === "uploading"} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void handleCertificate(f); }} />
            </label>
            {certificate.message ? <Alert tone="error" className="mt-3">{certificate.message}</Alert> : null}
          </div>

          <div className="mt-4">
            <label htmlFor="cv" className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center transition-colors duration-300", cv.status === "uploaded" ? "border-verified-emerald/40 bg-verified-emerald-soft/40" : "border-line bg-surface-canvas hover:border-accent-emerald/40 hover:bg-accent-emerald-soft/30")}>
              <span className="grid size-9 place-items-center rounded-xl bg-surface-card text-accent-emerald-hover shadow-sm">
                {cv.status === "uploading" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : cv.status === "uploaded" ? <FileCheck2 className="size-4 text-verified-emerald" aria-hidden /> : <UploadCloud className="size-4" aria-hidden />}
              </span>
              <span className="text-sm font-semibold text-brand-navy">{cv.status === "uploaded" ? cv.fileName : cv.status === "uploading" ? "Uploading CV…" : "Add your PDF CV (optional)"}</span>
              <span className="text-xs text-ink-muted">{cv.status === "uploaded" ? `${formatBytes(cv.sizeBytes)} · Uploaded` : "PDF only · max 10 MB · private storage"}</span>
              <input id="cv" type="file" className="sr-only" accept="application/pdf" disabled={cv.status === "uploading"} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void handleCv(f); }} />
            </label>
            {cv.message ? <Alert tone="error" className="mt-3">{cv.message}</Alert> : null}
            {cv.status === "uploaded" ? (
              <button type="button" className="mt-2 text-xs text-ink-muted underline" onClick={() => setCv(initialCv())}>Remove CV</button>
            ) : null}
          </div>

          <div className="mt-5 space-y-4">
            <Field label="Certificate Verification URL or Serial (Optional)" htmlFor="certificate-verification-ref" hint="If your digital diploma includes a QR verification link or serial number, paste it here.">
              <Input id="certificate-verification-ref" value={verificationRef} onChange={(e) => setVerificationRef(e.target.value)} placeholder="https://verify.university.edu/cert/12345" maxLength={500} autoComplete="off" spellCheck={false} />
            </Field>
            <div className={cn("rounded-xl border p-4 transition", registrarConsent ? "border-verified-emerald/30 bg-verified-emerald-soft/40" : "border-line bg-surface-canvas")}>
              <label htmlFor="registrar-consent" className="flex cursor-pointer items-start gap-3">
                <input id="registrar-consent" type="checkbox" checked={registrarConsent} onChange={(e) => setRegistrarConsent(e.target.checked)} className="mt-0.5 size-4 shrink-0 cursor-pointer accent-verified-emerald" />
                <span className="text-xs leading-5 text-ink-primary">I confirm this certificate is authentic and authorize University Talent Network to contact my university registrar or official verification portal to confirm my degree.</span>
              </label>
              <p className="mt-2 pl-7 text-[11px] leading-4 text-ink-muted">Required before you can submit for review.</p>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
              <ScanText className="size-4 text-accent-emerald-hover" aria-hidden />
              Automatic text check
            </div>
            {ocr.status === "idle" ? <p className="mt-2 rounded-xl border border-line bg-surface-canvas p-3 text-xs leading-5 text-ink-muted">Upload an image to extract visible text with tesseract.js. PDFs are reviewed manually.</p> : null}
            {ocr.status === "running" ? <div className="mt-2 flex items-center gap-2 rounded-xl border border-accent-emerald/20 bg-accent-emerald-soft p-3 text-xs font-medium text-accent-emerald-hover"><Loader2 className="size-4 animate-spin" aria-hidden />Reading the document…</div> : null}
            {ocr.status === "completed" && ocr.text ? (
              <div className="mt-2 rounded-xl border border-verified-emerald/25 bg-verified-emerald-soft/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-emerald-800">Text extracted</p>
                  {ocr.confidence !== null ? <Badge tone="emerald">{ocr.confidence}% confidence</Badge> : null}
                </div>
                <p className="mt-2 max-h-36 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-5 text-ink-primary/80">{ocr.text}</p>
              </div>
            ) : null}
            {ocr.status === "skipped" || ocr.status === "empty" || ocr.status === "failed" ? (
              <Alert tone={ocr.status === "failed" ? "error" : "info"} className="mt-2">{ocr.message}</Alert>
            ) : null}
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Assessment questions</p>
              {questionsStatus === "generating" ? <Loader2 className="size-4 animate-spin text-accent-emerald-hover" aria-hidden /> : null}
            </div>
            {questionsStatus === "idle" ? (
              <p className="mt-2 rounded-xl border border-line bg-surface-canvas p-3 text-xs leading-5 text-ink-muted">
                Upload your certificate to generate 4 tailored assessment questions.
              </p>
            ) : null}
            {questionsStatus === "generating" ? (
              <div className="mt-2 rounded-xl border border-accent-emerald/20 bg-accent-emerald-soft p-3 text-xs font-medium text-accent-emerald-hover" role="status" aria-live="polite">
                Generating your 4 assessment questions from your certificate…
              </div>
            ) : null}
            {questionsStatus === "error" ? (
              <div className="mt-2 space-y-2">
                <Alert tone="error">{questionsError}</Alert>
                <Button type="button" variant="secondary" size="sm" onClick={() => void generateQuestions()}>Try again</Button>
              </div>
            ) : null}
            {questionsStatus === "ready" && questions ? (
              <ol className="mt-2 space-y-1.5">
                {questions.map((q) => (
                  <li key={q.index} className="rounded-xl border border-line bg-surface-canvas p-2.5 text-[11px] leading-5 text-ink-muted">
                    <span className="font-bold text-accent-emerald-hover">Q{q.index}.</span> {q.question_text}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        </Card>

        {/* Assessment studio */}
        <Card>
          <CardHeader title="2. 4-question video session" description={`Total budget ${formatPitchDuration(TOTAL_BUDGET)} · ${PER_QUESTION}s per question. Camera only.`} action={<Badge tone={recording ? "danger" : video.blob ? "emerald" : "neutral"}><span className={cn("size-1.5 rounded-full", recording ? "animate-pulse bg-danger" : "bg-current")} aria-hidden />{recording ? "Recording" : video.blob ? "Recorded" : "Ready"}</Badge>} />

          <div className="mt-4 rounded-xl border border-line bg-surface-canvas p-3" role="status" aria-live="polite">
            {readiness.status === "ready" ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-accent-emerald-hover"><CheckCircle2 className="size-4" aria-hidden />Camera &amp; microphone ready</p>
                  <p className="mt-0.5 truncate text-[11px] text-ink-muted">{readiness.camera} · {readiness.microphone}</p>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={() => void checkReadiness()}><RotateCcw className="size-3.5" aria-hidden />Check again</Button>
              </div>
            ) : readiness.status === "checking" ? (
              <p className="flex items-center gap-2 text-sm font-medium text-ink-muted"><Loader2 className="size-4 animate-spin" aria-hidden />Asking for camera and microphone…</p>
            ) : readiness.status === "error" ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-danger"><AlertTriangle className="size-4" aria-hidden />Setup check failed</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-ink-muted">{readiness.message}</p>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={() => void checkReadiness()}>Try again</Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-card text-accent-emerald-hover ring-1 ring-inset ring-line"><Camera className="size-4" aria-hidden /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-brand-navy">Check your setup first</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-ink-muted">A quick camera and microphone test. Nothing is recorded or uploaded.</p>
                  </div>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={() => void checkReadiness()}><Mic className="size-3.5" aria-hidden />Check camera &amp; microphone</Button>
              </div>
            )}
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl bg-studio-obsidian">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-white/60">
                <Camera className="size-3.5" aria-hidden />
                Front camera · 720p
              </div>
              <span className="font-mono text-sm font-semibold tabular-nums text-white/60">
                {formatPitchDuration(recordedTotalRef.current || 0)} / {formatPitchDuration(TOTAL_BUDGET)}
              </span>
            </div>

            <div className="relative aspect-video w-full bg-[radial-gradient(circle_at_50%_20%,#1E2740_0%,#0E1424_50%,#070B16_100%)]">
              {video.url ? (
                <video src={video.url} controls playsInline className="absolute inset-0 size-full object-contain" />
              ) : (
                <>
                  <video ref={cameraRef} muted playsInline className={cn("absolute inset-0 size-full scale-x-[-1] object-cover", cameraActive ? "opacity-100" : "opacity-0")} />
                  {!cameraActive ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                      <span className="grid size-14 place-items-center rounded-full border border-white/10 bg-white/5 text-white/60"><Video className="size-7" aria-hidden /></span>
                      <p className="text-xs text-white/60">Your camera preview appears here. Gallery uploads are disabled by design.</p>
                    </div>
                  ) : null}
                  <div className="pointer-events-none absolute inset-6 rounded-2xl border border-white/[0.08]" aria-hidden />
                  {recording && sessionPhase === "active" ? (
                    <div className="absolute inset-x-4 top-4 rounded-xl border border-white/10 bg-black/40 p-3 backdrop-blur-md" role="status" aria-live="polite">
                      {questionPhase === "intro" ? (
                        <>
                          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/60">Get ready · Question {activeQuestion + 1} of 4</p>
                          <p className="mt-1 text-2xl font-bold text-white text-center">{INTRO - questionElapsed}s</p>
                        </>
                      ) : questionPhase === "display" ? (
                        <>
                          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/60">Question {activeQuestion + 1} of 4 · Read ({DISPLAY - (questionElapsed - (activeQuestion === 0 ? INTRO : 0))}s)</p>
                          <p className="mt-1 text-[11px] leading-4 text-white/90">{questions?.[activeQuestion]?.question_text}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/60">Question {activeQuestion + 1} of 4 · Answer now</p>
                          <p className="mt-1 text-[11px] leading-4 text-white/90">{questions?.[activeQuestion]?.question_text}</p>
                        </>
                      )}
                    </div>
                  ) : null}
                  {recording ? (
                    <div className="absolute inset-x-4 bottom-4">
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                        <div className="h-full rounded-full bg-verified-emerald transition-[width] duration-200" style={{ width: `${Math.round((questionElapsed / (activeQuestion === 0 ? INTRO + DISPLAY + ANSWER : DISPLAY + ANSWER)) * 100)}%` }} />
                      </div>
                      <p className="mt-1.5 text-center text-[10px] font-medium text-white/55">
                        {questionPhase === "intro"
                          ? `${INTRO - questionElapsed}s until question appears`
                          : questionPhase === "display"
                            ? `${DISPLAY - (questionElapsed - (activeQuestion === 0 ? INTRO : 0))}s to read`
                            : `${(activeQuestion === 0 ? INTRO + DISPLAY + ANSWER : DISPLAY + ANSWER) - questionElapsed}s left on this question`}
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {recorderError ? <Alert tone="error" className="mt-3">{recorderError}</Alert> : null}

          {/* Controls */}
          <div className="mt-4 space-y-3">
            {sessionPhase === "idle" ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => void beginSession()} disabled={certificate.status !== "uploaded" || questionsStatus !== "ready"}>
                  <Play className="size-4" aria-hidden />
                  Begin 4-question session
                </Button>
                {certificate.status !== "uploaded" ? <p className="text-xs text-ink-muted">Upload your certificate first.</p> : null}
                {questionsStatus !== "ready" ? <p className="text-xs text-ink-muted">Questions must be ready before recording.</p> : null}
              </div>
            ) : null}

            {sessionPhase === "ready" ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-brand-navy" role="status" aria-live="polite">
                  Question {activeQuestion + 1} of 4 — {questions?.[activeQuestion]?.question_text}
                </p>
                <p className="text-xs text-ink-muted">
                  Clicking start begins a {INTRO}s countdown, then {DISPLAY}s to read the question, then {ANSWER}s to answer.
                </p>
                <Button onClick={() => startQuestion(activeQuestion)} disabled={questionsStatus !== "ready"}>
                  <Play className="size-4" aria-hidden />
                  Start Question {activeQuestion + 1}
                </Button>
              </div>
            ) : null}

            {sessionPhase === "active" ? (
              <div className="flex flex-wrap items-center gap-2">
                {questionPhase === "answer" ? (
                  <>
                    <Button variant="danger" onClick={() => finishQuestion(activeQuestion)}>
                      <Square className="size-4" aria-hidden />
                      Done with Q{activeQuestion + 1}
                    </Button>
                    <span className="text-xs text-ink-muted">Or wait for the timer to finish.</span>
                  </>
                ) : (
                  <span className="text-xs text-ink-muted">
                    {questionPhase === "intro" ? "Get ready..." : "Read the question above..."}
                  </span>
                )}
              </div>
            ) : null}

            {sessionPhase === "between" ? (
              <div className="space-y-3" role="status" aria-live="polite">
                <p className="text-sm font-semibold text-brand-navy">Question {activeQuestion} of 4 complete. Ready for the next.</p>
                <p className="text-xs text-ink-muted">{questions?.[activeQuestion]?.question_text}</p>
                <p className="text-xs text-ink-muted">
                  Clicking start shows the question for {DISPLAY}s, then {ANSWER}s to answer.
                </p>
                <Button onClick={() => startQuestion(activeQuestion)}>
                  <ChevronRight className="size-4" aria-hidden />
                  Start Timing — Question {activeQuestion + 1}
                </Button>
              </div>
            ) : null}

            {sessionPhase === "complete" ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="emerald"><CheckCircle2 className="size-3.5" aria-hidden />{formatPitchDuration(video.durationSeconds)} recorded · {chapters.length}/4 chapters</Badge>
                <Button variant="secondary" size="sm" onClick={discardSession}><RotateCcw className="size-4" aria-hidden />Re-record</Button>
              </div>
            ) : null}

            {video.blob && sessionPhase !== "complete" ? null : null}
          </div>

          {chapters.length > 0 ? (
            <div className="mt-4 rounded-xl border border-line bg-surface-canvas p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Recorded chapters</p>
              <ol className="mt-2 space-y-1.5">
                {chapters.map((c) => (
                  <li key={c.index} className="flex items-center justify-between gap-2 text-[11px] text-ink-muted">
                    <span className="font-semibold text-brand-navy">Q{c.index}</span>
                    <span className="font-mono tabular-nums">{formatPitchDuration(c.start)} – {formatPitchDuration(c.end)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </Card>
      </div>

      <Card className={cn("flex flex-wrap items-center justify-between gap-4", canFinalize ? "border-verified-emerald/30" : undefined)}>
        <div className="flex items-start gap-3">
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", canFinalize ? "bg-verified-emerald-soft text-verified-emerald" : "bg-surface-muted text-ink-muted")}>
            {canFinalize ? <CheckCircle2 className="size-5" aria-hidden /> : <AlertTriangle className="size-5" aria-hidden />}
          </span>
          <div>
            <p className="text-sm font-semibold text-brand-navy">{canFinalize ? "Everything is ready" : "Submission gates"}</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              Certificate uploaded · {questionsStatus === "ready" ? "4 questions ready" : "questions pending"} · pitch {video.durationSeconds ? formatPitchDuration(video.durationSeconds) : "not recorded"} · {video.durationSeconds >= MIN_PITCH_SECONDS ? "60s minimum met" : `${MIN_PITCH_SECONDS}s minimum not met`} · {registrarConsent ? "registrar consent recorded" : "registrar consent required"}
            </p>
          </div>
        </div>
        <Button size="lg" disabled={!canFinalize} loading={submitting} onClick={() => void submitForReview()}>
          Submit for review
        </Button>
      </Card>
    </div>
  );
}
