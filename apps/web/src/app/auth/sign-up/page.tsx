import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Join University Talent Network as a graduate or an employer.",
};

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="h-[560px] animate-pulse rounded-2xl bg-surface-card" />}>
      <SignUpForm />
    </Suspense>
  );
}
