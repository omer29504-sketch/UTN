"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Eye, Loader2, Lock, Printer, ShieldCheck, TimerReset } from "lucide-react";
import {
  CERTIFICATE_ACK_TICK_MS,
  CERTIFICATE_ACK_TTL_MS,
  CERTIFICATE_REACK_BUTTON_LABEL,
  CERTIFICATE_VIEWER_PRIVACY_SHIELD_TEXT,
  CERTIFICATE_WARNING_POINTS,
  EMPLOYER_CONFIDENTIALITY_CHECKBOX_LABEL,
  EMPLOYER_CONFIDENTIALITY_CLAUSE,
  EMPLOYER_CONFIDENTIALITY_ROUTE,
  WATERMARK_REFRESH_MS,
  buildWatermarkSignature,
  certificateAckRemainingMs,
  formatAckCountdown,
  hasAcceptedEmployerTos,
  isCertificateAckExpired,
  type DocumentAuditEventType,
} from "@utn/shared";
import { authFetch, readApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/** Employer identity used for the forensic watermark and the audit trail. */
export interface EmployerViewerIdentity {
  employerId: string;
  employerName: string;
  employerEmail: string;
  /** profiles.employer_tos_accepted_at — null until the clause is accepted. */
  tosAcceptedAt: string | null;
}

type ViewerStatus = "idle" | "loading" | "ready" | "error";
type LockReason = "initial" | "expired" | "capture";

const PDF_WORKER_SRC = "/pdfjs/pdf.worker.min.mjs";
const MAX_CANVAS_WIDTH = 980;
const MAX_CANVAS_HEIGHT = 12_000;
const FOCUS_LOG_THROTTLE_MS = 4_000;
const TOS_ACCEPTED_EVENT = "utn:employer-tos-accepted";

/**
 * Zero-download confidential certificate viewer.
 *
 * The document bytes are fetched from /api/employer/certificates/[id]/stream and
 * painted into an in-memory <canvas>. There is no <img src>, no <a download>,
 * no blob URL left behind, and no presigned link in the DOM.
 *
 * Protection layers:
 *   * click-through confidentiality clause before the first view
 *   * every-open + hourly (CERTIFICATE_ACK_TTL_MS) re-acknowledgment warning
 *   * burned-in canvas watermark + live SVG watermark overlay
 *   * right-click / selection / drag suppression
 *   * window-blur & tab-hidden privacy shield (logged as focus_loss_blur)
 *   * PrintScreen / Ctrl+P / Ctrl+S / Ctrl+Shift+I kill-switch
 *   * @media print rules in globals.css hide the whole viewer
 */
export function SecureCertificateViewer({
  candidateId,
  employer,
  className,
}: {
  candidateId: string;
  employer: EmployerViewerIdentity;
  className?: string;
}) {
  const [tosAcceptedAt, setTosAcceptedAt] = useState<string | null>(employer.tosAcceptedAt);
  const [tosChecked, setTosChecked] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [tosError, setTosError] = useState<string | null>(null);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [lockReason, setLockReason] = useState<LockReason>("initial");
  const [lastAckAt, setLastAckAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(CERTIFICATE_ACK_TTL_MS);

  const [status, setStatus] = useState<ViewerStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const [shielded, setShielded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [watermarkAt, setWatermarkAt] = useState(() => new Date());

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const blobRef = useRef<{ blob: Blob; contentType: string } | null>(null);
  const watermarkRef = useRef("");
  const lastFocusLogRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);

  const watermarkText = buildWatermarkSignature({
    employerName: employer.employerName,
    employerEmail: employer.employerEmail,
    employerId: employer.employerId,
    at: watermarkAt,
  });

  useEffect(() => {
    watermarkRef.current = watermarkText;
  }, [watermarkText]);

  // Accepting on one card must unlock the gate on every other mounted card.
  useEffect(() => {
    const onAccepted = (event: Event) => {
      const acceptedAt = (event as CustomEvent<string>).detail;
      if (typeof acceptedAt === "string" && acceptedAt) {
        setTosAcceptedAt(acceptedAt);
      }
    };
    window.addEventListener(TOS_ACCEPTED_EVENT, onAccepted);
    return () => window.removeEventListener(TOS_ACCEPTED_EVENT, onAccepted);
  }, []);

  // ── Audit telemetry ───────────────────────────────────────────────────────

  const logEvent = useCallback(
    (eventType: DocumentAuditEventType) => {
      void authFetch("/api/employer/certificates/security-event", {
        method: "POST",
        body: JSON.stringify({ eventType, candidateId }),
      }).catch(() => undefined);
    },
    [candidateId],
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 6_000);
  }, []);

  useEffect(
    () => () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    },
    [],
  );

  // ── Canvas painting ───────────────────────────────────────────────────────

  const paintWatermark = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const signature = watermarkRef.current;
      if (!signature) return;

      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = "#0F172A";
      ctx.font = `600 ${Math.max(11, Math.round(width / 64))}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const stepX = Math.max(280, Math.round(width / 1.7));
      const stepY = 148;

      let row = 0;
      for (let y = stepY / 2; y < height + stepY; y += stepY) {
        const offset = row % 2 === 0 ? 0 : stepX / 2;
        for (let x = -stepX; x < width + stepX; x += stepX) {
          ctx.save();
          ctx.translate(x + offset, y);
          ctx.rotate(-Math.PI / 9);
          ctx.fillText(signature, 0, 0);
          ctx.restore();
        }
        row += 1;
      }
      ctx.restore();
    },
    [],
  );

  const blankCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#0F172A";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }, []);

  const renderBlob = useCallback(
    async (blob: Blob, contentType: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("This browser cannot render a secure canvas.");

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const availableWidth = containerRef.current?.clientWidth ?? MAX_CANVAS_WIDTH;
      const targetWidth = Math.max(320, Math.min(MAX_CANVAS_WIDTH, availableWidth));

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (contentType === "application/pdf") {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

        const data = new Uint8Array(await blob.arrayBuffer());
        const pdf = await pdfjs.getDocument({
          data,
          isEvalSupported: false,
        }).promise;

        const firstPage = await pdf.getPage(1);
        let scale = targetWidth / firstPage.getViewport({ scale: 1 }).width;

        const sizes: { width: number; height: number }[] = [];
        let totalHeight = 0;
        for (let index = 1; index <= pdf.numPages; index += 1) {
          const page = await pdf.getPage(index);
          const viewport = page.getViewport({ scale });
          sizes.push({ width: viewport.width, height: viewport.height });
          totalHeight += viewport.height;
        }

        if (totalHeight > MAX_CANVAS_HEIGHT) {
          scale *= MAX_CANVAS_HEIGHT / totalHeight;
          sizes.length = 0;
          totalHeight = 0;
          for (let index = 1; index <= pdf.numPages; index += 1) {
            const page = await pdf.getPage(index);
            const viewport = page.getViewport({ scale });
            sizes.push({ width: viewport.width, height: viewport.height });
            totalHeight += viewport.height;
          }
        }

        canvas.width = Math.round(targetWidth * dpr);
        canvas.height = Math.max(1, Math.round(totalHeight * dpr));
        canvas.style.width = `${Math.round(targetWidth)}px`;
        canvas.style.height = `${Math.round(totalHeight)}px`;

        ctx.scale(dpr, dpr);

        let offsetY = 0;
        for (let index = 1; index <= pdf.numPages; index += 1) {
          const page = await pdf.getPage(index);
          const viewport = page.getViewport({ scale });
          ctx.save();
          ctx.translate(0, offsetY);
          await page.render({ canvasContext: ctx, viewport }).promise;
          ctx.restore();
          offsetY += sizes[index - 1]?.height ?? viewport.height;
        }

        paintWatermark(ctx, targetWidth, totalHeight);
        return;
      }

      const bitmap = await createImageBitmap(blob);
      const scale = targetWidth / bitmap.width;
      const targetHeight = bitmap.height * scale;

      canvas.width = Math.round(targetWidth * dpr);
      canvas.height = Math.max(1, Math.round(targetHeight * dpr));
      canvas.style.width = `${Math.round(targetWidth)}px`;
      canvas.style.height = `${Math.round(targetHeight)}px`;

      ctx.scale(dpr, dpr);
      ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
      bitmap.close();
      paintWatermark(ctx, targetWidth, targetHeight);
    },
    [paintWatermark],
  );

  // Fetch + paint whenever the viewer becomes acknowledged again.
  useEffect(() => {
    if (!acknowledged) return;

    let cancelled = false;

    const cached = blobRef.current;
    if (cached) {
      setStatus("loading");
      void renderBlob(cached.blob, cached.contentType)
        .then(() => {
          if (!cancelled) setStatus("ready");
        })
        .catch((cause: unknown) => {
          if (cancelled) return;
          setError(cause instanceof Error ? cause.message : "Could not render the document.");
          setStatus("error");
        });
      return () => {
        cancelled = true;
      };
    }

    setStatus("loading");
    setError(null);

    void (async () => {
      try {
        const response = await authFetch(`/api/employer/certificates/${candidateId}/stream`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          if (!cancelled) {
            setError(await readApiError(response));
            setStatus("error");
          }
          return;
        }

        const headerSignature = response.headers.get("x-watermark-signature");
        if (headerSignature) {
          try {
            watermarkRef.current = decodeURIComponent(headerSignature);
          } catch {
            // Keep the locally derived signature.
          }
        }

        const contentType =
          (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
        const blob = await response.blob();
        if (cancelled) return;

        blobRef.current = { blob, contentType };
        await renderBlob(blob, contentType);
        if (!cancelled) setStatus("ready");
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Could not open the document.");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [acknowledged, candidateId, renderBlob]);

  // ── 1-hour acknowledgment expiry (checked every 10 s) ─────────────────────

  useEffect(() => {
    if (!acknowledged || lastAckAt === null) return;

    const tick = () => {
      if (isCertificateAckExpired(lastAckAt)) {
        setAcknowledged(false);
        setLockReason("expired");
        setRemainingMs(0);
        blankCanvas();
        return;
      }
      setRemainingMs(certificateAckRemainingMs(lastAckAt));
    };

    tick();
    const interval = window.setInterval(tick, CERTIFICATE_ACK_TICK_MS);
    return () => window.clearInterval(interval);
  }, [acknowledged, lastAckAt, blankCanvas]);

  // ── Watermark timestamp refresh (every 60 s) ──────────────────────────────

  useEffect(() => {
    if (!viewerOpen) return;
    const interval = window.setInterval(() => setWatermarkAt(new Date()), WATERMARK_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [viewerOpen]);

  // ── Focus loss / tab hidden → privacy shield + audit ──────────────────────

  useEffect(() => {
    if (!viewerOpen) return;

    const hide = () => {
      setShielded(true);
      const now = Date.now();
      if (now - lastFocusLogRef.current > FOCUS_LOG_THROTTLE_MS) {
        lastFocusLogRef.current = now;
        logEvent("focus_loss_blur");
      }
    };

    const reveal = () => {
      if (document.visibilityState === "visible") setShielded(false);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") hide();
      else reveal();
    };

    window.addEventListener("blur", hide);
    window.addEventListener("focus", reveal);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("blur", hide);
      window.removeEventListener("focus", reveal);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [viewerOpen, logEvent]);

  // ── Print / save / devtools kill-switch ───────────────────────────────────

  useEffect(() => {
    if (!viewerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      const modifier = event.ctrlKey || event.metaKey;
      const lower = key.toLowerCase();

      const isPrintScreen = key === "PrintScreen" || key === "Snapshot";
      const isPrint = modifier && lower === "p";
      const isSave = modifier && lower === "s";
      const isDevtools = modifier && event.shiftKey && ["i", "j", "c"].includes(lower);

      if (!isPrintScreen && !isPrint && !isSave && !isDevtools) return;

      event.preventDefault();
      event.stopPropagation();

      blankCanvas();
      blobRef.current = null;
      setAcknowledged(false);
      setLockReason("capture");
      setShielded(false);
      showToast(
        "Capture attempt blocked. Printing, saving, and screenshots of candidate credentials are strictly prohibited and have been logged.",
      );
      logEvent("print_or_devtools_attempt");
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [viewerOpen, blankCanvas, showToast, logEvent]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const acceptConfidentiality = useCallback(async () => {
    if (!tosChecked) return;
    setAccepting(true);
    setTosError(null);
    try {
      const response = await authFetch("/api/employer/certificates/security-event", {
        method: "POST",
        body: JSON.stringify({
          eventType: "tos_accepted",
          candidateId,
        }),
      });

      if (!response.ok) {
        setTosError(await readApiError(response));
        return;
      }

      const body = (await response.json()) as { employerTosAcceptedAt?: string | null };
      const acceptedAt = body.employerTosAcceptedAt ?? new Date().toISOString();
      setTosAcceptedAt(acceptedAt);
      window.dispatchEvent(new CustomEvent(TOS_ACCEPTED_EVENT, { detail: acceptedAt }));
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
    setError(null);
  }, []);

  const acknowledge = useCallback(() => {
    const now = Date.now();
    setAcknowledged(true);
    setShielded(false);
    setLastAckAt(now);
    setRemainingMs(CERTIFICATE_ACK_TTL_MS);
    setToast(null);
    logEvent("hourly_reack_completed");
  }, [logEvent]);

  const closeViewer = useCallback(() => {
    setViewerOpen(false);
    setAcknowledged(false);
    setShielded(false);
    setToast(null);
    blobRef.current = null;
    blankCanvas();
  }, [blankCanvas]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!hasAcceptedEmployerTos(tosAcceptedAt)) {
    return (
      <div
        className={cn(
          "secure-certificate-viewer space-y-4 rounded-2xl border border-line bg-surface-card p-4 shadow-card",
          className,
        )}
      >
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-brand-navy text-white">
            <ShieldCheck className="size-4" aria-hidden />
          </span>
          <div>
            <p className="font-display text-sm font-bold text-brand-navy">
              {EMPLOYER_CONFIDENTIALITY_CLAUSE.title}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">
              Version {EMPLOYER_CONFIDENTIALITY_CLAUSE.version} · required before any certificate
              can be displayed.
            </p>
          </div>
        </div>

        <div
          className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-line bg-surface-canvas p-3 text-xs leading-5 text-ink-primary"
          tabIndex={0}
          role="region"
          aria-label="Employer confidentiality clause"
        >
          {EMPLOYER_CONFIDENTIALITY_CLAUSE.sections.map((section) => (
            <div key={section.heading}>
              <p className="font-semibold text-brand-navy">{section.heading}</p>
              <p className="mt-1 text-ink-muted">{section.body}</p>
            </div>
          ))}
          <Link
            href={EMPLOYER_CONFIDENTIALITY_ROUTE}
            className="inline-block font-semibold text-accent-indigo hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Open the full clause in a new tab
          </Link>
        </div>

        <label className="flex items-start gap-2 text-xs leading-5 text-brand-navy">
          <input
            type="checkbox"
            checked={tosChecked}
            onChange={(event) => setTosChecked(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-verified-emerald"
          />
          <span>{EMPLOYER_CONFIDENTIALITY_CHECKBOX_LABEL}</span>
        </label>

        {tosError ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-danger">{tosError}</p>
        ) : null}

        <button
          type="button"
          onClick={() => void acceptConfidentiality()}
          disabled={!tosChecked || accepting}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-navy-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          {accepting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ShieldCheck className="size-4" aria-hidden />
          )}
          Accept &amp; continue
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "secure-certificate-viewer space-y-3 rounded-2xl border border-line bg-surface-card p-4 shadow-card",
        className,
      )}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      style={{ WebkitUserSelect: "none", userSelect: "none" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-xl bg-verified-emerald-soft text-emerald-700">
            <Lock className="size-4" aria-hidden />
          </span>
          <div>
            <p className="font-display text-sm font-bold text-brand-navy">
              Confidential certificate
            </p>
            <p className="text-[11px] text-ink-muted">
              Rendered in memory · watermark and access logged
            </p>
          </div>
        </div>
        {viewerOpen ? (
          <button
            type="button"
            onClick={closeViewer}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-brand-navy hover:bg-surface-muted"
          >
            Close viewer
          </button>
        ) : null}
      </div>

      {!viewerOpen ? (
        <button
          type="button"
          onClick={openViewer}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-navy-soft"
        >
          <Eye className="size-4" aria-hidden />
          View certificate (secure viewer)
        </button>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-studio-obsidian-line bg-studio-obsidian">
          <div
            ref={containerRef}
            className="relative flex justify-center"
            aria-live="polite"
            aria-busy={status === "loading"}
          >
            <canvas
              ref={canvasRef}
              className={cn("block h-auto max-w-full", shielded && "invisible")}
              style={!acknowledged ? { filter: "blur(32px)" } : undefined}
            />

            {/* Live forensic watermark overlay (refreshes every 60 s). */}
            {acknowledged && !shielded ? (
              <ForensicWatermark candidateId={candidateId} signature={watermarkText} />
            ) : null}
          </div>

          {status === "loading" ? (
            <div className="fixed inset-0 z-30 grid place-items-center bg-studio-obsidian/85">
              <span className="flex items-center gap-2 text-xs font-semibold text-white/80">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Decrypting certificate…
              </span>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="fixed inset-0 z-30 grid place-items-center bg-studio-obsidian p-6">
              <p className="max-w-sm text-center text-xs leading-5 text-red-300">
                {error ?? "Could not display this certificate."}
              </p>
            </div>
          ) : null}

          {shielded ? <PrivacyShield /> : null}

          {!acknowledged ? (
            <AckModal
              reason={lockReason}
              employerEmail={employer.employerEmail}
              remainingMs={remainingMs}
              onAcknowledge={acknowledge}
            />
          ) : null}
        </div>
      )}

      {toast ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-danger/30 bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-danger"
        >
          <Printer className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{toast}</span>
        </div>
      ) : null}

      {viewerOpen && acknowledged ? (
        <p className="flex items-center gap-1.5 text-[11px] text-ink-muted">
          <TimerReset className="size-3.5" aria-hidden />
          Acknowledgment expires in {formatAckCountdown(remainingMs)} — you will be asked to
          re-confirm.
        </p>
      ) : null}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ForensicWatermark({ candidateId, signature }: { candidateId: string; signature: string }) {
  const patternId = `wm-${candidateId.replace(/[^a-zA-Z0-9-]/g, "")}`;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 select-none overflow-hidden">
      <svg className="size-full opacity-[0.22]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id={patternId}
            width="760"
            height="190"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-24)"
          >
            <text x="0" y="95" fill="#0F172A" fontSize="11" fontWeight="600">
              {signature}
            </text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
      <p className="absolute bottom-1 right-2 rounded bg-brand-navy/70 px-1.5 py-0.5 text-[9px] font-semibold text-white/80">
        {signature}
      </p>
    </div>
  );
}

function PrivacyShield() {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-brand-navy px-6 text-center">
      <div className="space-y-2">
        <Lock className="mx-auto size-6 text-verified-emerald" aria-hidden />
        <p className="font-display text-sm font-bold text-white">
          {CERTIFICATE_VIEWER_PRIVACY_SHIELD_TEXT}
        </p>
        <p className="text-[11px] leading-5 text-white/60">
          Return to this window to continue. Every hide event is recorded in the audit trail.
        </p>
      </div>
    </div>
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
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-brand-navy/95 px-4 py-6">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-verified-emerald/30 bg-brand-navy p-5 text-white shadow-floating">
        <div className="flex items-start gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-verified-emerald/15 text-verified-emerald">
            <AlertTriangle className="size-5" aria-hidden />
          </span>
          <div>
            <h3 className="font-display text-base font-bold text-white">{heading}</h3>
            <p className="mt-1 text-[11px] leading-5 text-white/60">
              {reason === "expired"
                ? `Your 60-minute acknowledgment window has ended. Confirm again to continue viewing.`
                : `Access is restricted to ${employerEmail || "your employer account"}.`}
            </p>
          </div>
        </div>

        <ul className="space-y-1.5 text-[11px] leading-5 text-white/75">
          {CERTIFICATE_WARNING_POINTS.map((point) => (
            <li key={point} className="flex gap-2">
              <span
                aria-hidden
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-verified-emerald"
              />
              <span>{point}</span>
            </li>
          ))}
        </ul>

        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] leading-5 text-white/70">
          <p>
            <span className="font-semibold text-white">Account:</span> {employerEmail || "—"}
          </p>
          <p>
            <span className="font-semibold text-white">Session:</span> your IP address, user agent
            and access time are recorded for this document.
          </p>
          {reason === "expired" ? (
            <p>
              <span className="font-semibold text-white">Previous window:</span>{" "}
              {formatAckCountdown(remainingMs)} remaining
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onAcknowledge}
          className="w-full rounded-xl bg-verified-emerald px-4 py-3 text-sm font-bold text-brand-navy transition hover:bg-emerald-400"
        >
          {CERTIFICATE_REACK_BUTTON_LABEL}
        </button>
      </div>
    </div>
  );
}
