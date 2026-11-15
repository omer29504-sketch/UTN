"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import { authFetch, readApiError } from "@/lib/api/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

export function AdminDecisionPanel({
  candidateId,
  candidateName,
  status,
}: {
  candidateId: string;
  candidateName: string;
  status: "unverified" | "pending" | "verified" | "rejected";
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);

  async function submit(decision: "approve" | "reject") {
    setError(null);

    if (decision === "reject" && reason.trim().length === 0) {
      setError("Give the candidate a clear, actionable reason for rejection.");
      return;
    }

    setPending(decision);

    try {
      const response = await authFetch("/api/admin/verification", {
        method: "POST",
        body: JSON.stringify({
          candidateId,
          decision,
          rejectionReason: decision === "reject" ? reason.trim() : undefined,
        }),
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      router.replace("/admin/verification");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save the decision.");
    } finally {
      setPending(null);
    }
  }

  if (status !== "pending") {
    return (
      <Alert tone={status === "verified" ? "success" : "info"} title="Decision already recorded">
        {candidateName} is currently{" "}
        {status === "verified" ? "verified" : status === "rejected" ? "rejected" : "not submitted"}.
        Resubmissions create a new pending review.
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Field
        label="Rejection reason"
        htmlFor="rejectionReason"
        hint="Sent to the candidate and stored in the audit trail. Required only when rejecting."
      >
        <Textarea
          id="rejectionReason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="The certificate is cropped and the degree title is not visible. Please upload a full-page scan."
          maxLength={1_000}
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="emerald"
          loading={pending === "approve"}
          disabled={pending !== null}
          onClick={() => void submit("approve")}
        >
          <BadgeCheck className="size-4" aria-hidden />
          Approve candidate
        </Button>
        <Button
          variant="danger"
          loading={pending === "reject"}
          disabled={pending !== null}
          onClick={() => void submit("reject")}
        >
          <ShieldAlert className="size-4" aria-hidden />
          Request changes
        </Button>
      </div>
    </div>
  );
}
