import { Link, useRouter } from "expo-router";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { signInSchema, type SignInInput } from "@utn/shared";

import { AuthShell } from "@/components/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, configured } = useAuth();

  const [values, setValues] = useState<SignInInput>({ email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof SignInInput, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit() {
    setFormError(null);

    const parsed = signInSchema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof SignInInput, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof SignInInput;
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setPending(true);

    const result = await signIn(parsed.data);
    setPending(false);

    if (result.error) {
      setFormError(result.error);
      return;
    }

    router.replace("/dashboard");
  }

  return (
    <AuthShell>
      <Text className="font-inter-semibold text-[10px] uppercase tracking-[2px] text-accent-indigo">
        Welcome back
      </Text>
      <Text className="mt-2 font-jakarta-extrabold text-3xl tracking-[-0.8px] text-brand-navy">
        Sign in to your account
      </Text>
      <Text className="mt-2 font-inter text-[13px] leading-6 text-ink-muted">
        Continue your verification, review queue, or employer workspace.
      </Text>

      {!configured ? (
        <Alert tone="error" title="Supabase is not configured" className="mt-4">
          Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to the mobile environment.
        </Alert>
      ) : null}

      {formError ? (
        <Alert tone="error" className="mt-4">
          {formError}
        </Alert>
      ) : null}

      <View className="mt-6 gap-4">
        <Field label="Email" error={errors.email} required>
          <Input
            value={values.email}
            onChangeText={(email) => setValues((current) => ({ ...current, email }))}
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
            invalid={Boolean(errors.email)}
          />
        </Field>

        <Field label="Password" error={errors.password} required>
          <View className="flex-row items-center">
            <Input
              value={values.password}
              onChangeText={(password) => setValues((current) => ({ ...current, password }))}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              placeholder="Your password"
              className="flex-1 pr-11"
              invalid={Boolean(errors.password)}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              onPress={() => setShowPassword((current) => !current)}
              className="absolute right-0 h-11 w-11 items-center justify-center"
            >
              {showPassword ? (
                <EyeOff size={16} color="#64748B" />
              ) : (
                <Eye size={16} color="#64748B" />
              )}
            </Pressable>
          </View>
        </Field>

        <Button
          label="Sign in"
          size="lg"
          loading={pending}
          icon={<ArrowRight size={16} color="#FFFFFF" />}
          onPress={() => void handleSubmit()}
        />
      </View>

      <Text className="mt-6 text-center font-inter text-[12px] text-ink-muted">
        New here?{" "}
        <Link href="/auth/sign-up" className="font-inter-semibold text-accent-indigo">
          Create an account
        </Link>
      </Text>

      <View className="mt-8 rounded-xl border border-line bg-white p-3.5">
        <View className="flex-row items-center gap-1.5">
          <LockKeyhole size={12} color="#4F46E5" />
          <Text className="font-inter-semibold text-[10px] text-brand-navy">
            Local demo accounts
          </Text>
        </View>
        <Text className="mt-1.5 font-inter text-[10px] leading-5 text-ink-muted">
          Candidate amara.okafor@gmail.com · Employer hiring@northwindlabs.com · Admin
          admin@utn.dev
        </Text>
        <Text className="mt-1 font-inter text-[10px] text-ink-muted">
          Passwords are listed in the README for local development.
        </Text>
      </View>
    </AuthShell>
  );
}
