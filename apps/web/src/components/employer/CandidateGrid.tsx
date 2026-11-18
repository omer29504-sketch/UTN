"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { EmployerCandidateCard } from "@utn/shared";
import type { EmployerViewerIdentity } from "@/components/employer/secure-certificate-viewer";
import { CandidateCard } from "@/components/employer/candidate-card";
import { CandidateDossierDrawer } from "@/components/employer/CandidateDossierDrawer";

interface Props {
  candidates: EmployerCandidateCard[];
  companyId: string;
  employer: EmployerViewerIdentity;
  /** Live credit balance resolved on the server. */
  initialCredits: number | null;
}

/**
 * Client shell around the employer talent grid.
 *
 * The server owns candidate data and credit truth; this component only owns
 * the "which dossier is open" playlist cursor, the auto-play intent, and the
 * optimistic credit balance. After an unlock it asks the server to refresh so
 * the newly released contact fields and certificate arrive through the normal
 * RLS path instead of being invented on the client.
 */
export function CandidateGrid({ candidates, companyId, employer, initialCredits }: Props) {
  const router = useRouter();
  const [credits, setCredits] = useState<number | null>(initialCredits);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);

  const open = useCallback((index: number, play: boolean) => {
    setOpenIndex(index);
    setAutoPlay(play);
  }, []);

  const close = useCallback(() => {
    setOpenIndex(null);
    setAutoPlay(false);
  }, []);

  const step = useCallback((index: number) => {
    setOpenIndex(index);
    // Stepping is a deliberate review action, never an autoplay chain.
    setAutoPlay(false);
  }, []);

  const handleUnlocked = useCallback(
    (_candidateId: string, balance: number | null) => {
      setCredits(balance);
      router.refresh();
    },
    [router],
  );

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {candidates.map((candidate, index) => (
          <div key={candidate.candidate_id} className="h-full animate-slide-in">
            <CandidateCard
              candidate={candidate}
              active={openIndex === index}
              onOpen={() => open(index, false)}
              onPlay={() => open(index, true)}
            />
          </div>
        ))}
      </div>

      {openIndex !== null && candidates[openIndex] ? (
        <CandidateDossierDrawer
          candidates={candidates}
          index={openIndex}
          companyId={companyId}
          employer={employer}
          credits={credits}
          autoPlay={autoPlay}
          onClose={close}
          onStep={step}
          onUnlocked={handleUnlocked}
        />
      ) : null}
    </>
  );
}
