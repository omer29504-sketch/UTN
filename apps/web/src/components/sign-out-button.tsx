"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await createSupabaseBrowserClient().auth.signOut();
    } finally {
      router.replace("/auth/sign-in");
      router.refresh();
    }
  }

  return (
    <Button variant="ghost" size="sm" loading={pending} onClick={() => void signOut()}>
      <LogOut className="size-4" aria-hidden />
      Sign out
    </Button>
  );
}
