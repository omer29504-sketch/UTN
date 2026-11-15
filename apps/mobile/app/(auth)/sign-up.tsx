import { Link, useRouter } from "expo-router";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  GraduationCap,
  MailCheck,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { signUpMetadataSchema, type SignUpMetadataInput } from "@utn/shared";

import { AuthShell } from "@/components/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/cn";

type Role = "candidate" | "employer";
type FieldErrors = Partial<Record<keyof SignUpMetadataInput, string>>;

const roleOptions: {
  value: Role;
  label: string;
  description: string;
  icon: typeof GraduationCap;
}[] = [
  {
    value: "candidate",
    label: "I'm a graduate",
    description: "Verify your degree and publish a pitch.",
    icon: GraduationCap,
  },
  {
    value: "employer",
    label: "I'm hiring",
    description: "Discover verified graduates with a corporate email.",
    icon: Building2,
  },
];

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp, configured } = useAuth();

  const [role, setRole] = useState<Role>("candidate");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit() {
    setFormError(null);

    const parsed = signUpMetadataSchema.safeParse({
      role,
      fullName,
      email,
      password,
      companyName: role === "employer" ? companyName : undefined,
    });

    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof SignUpMetadataInput;
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setPending(true);

    const result = await signUp(parsed.data);
    setPending(false);

    if (result.error) {
      setFormError(result.error);
      return;
    }

    if (result.needsConfirmation) {
      setSent(true);
      return;
    }

    router.replace(role === "employer" ? "/employer/company" : "/candidate/profile");
  }

  if (sent) {
    return (
      <AuthShell>
        <View className="items-center pt-10">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-verified-emerald-soft">
            <MailCheck size={30} color="#10B981" />
          </View>
          <Text className="mt-5 text-center font-jakarta-extrabold text-2xl text-brand-navy">
            Confirm your email
          </Text>
          <Text className="mt-3 text-center font-inter text-[13px] leading-6 text-ink-muted">
            We sent a confirmation link to{" "}
            <Text className="font-inter-semibold text-brand-navy">{email}</Text>. Open it in your
            inbox, then return here to sign in.
          </Text>
          <Button
            label="Go to sign in"
            className="mt-6 self-center"
            icon={<ArrowRight size={16} color="#FFFFFF" />}
            onPress={() => router.replace("/auth/sign-in")}
          />
        </View>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Text className="font-inter-semibold text-[10px] uppercase tracking-[2px] text-accent-indigo">
        Create an account
      </Text>
      <Text className="mt-2 font-jakarta-extrabold text-3xl tracking-[-0.8px] text-brand-navy">
        Start with the right profile
      </Text>
      <Text className="mt-2 font-inter text-[13px] leading-6 text-ink-muted">
        Candidates verify their degree. Employers need an official company email.
      </Text>

      <View className="mt-5 flex-row gap-2.5">
        {roleOptions.map((option) => {
          const active = role === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => {
                setRole(option.value);
                setErrors({});
              }}
              className={cn(
                "flex-1 rounded-xl border p-3",
                active
                  ? "border-accent-indigo bg-accent-indigo-soft"
                  : "border-line bg-white",
              )}
            >
              <option.icon size={18} color={active ? "#4F46E5" : "#64748B"} />
              <Text className="mt-2 font-inter-semibold text-[12px] text-brand-navy">
                {option.label}
              </Text>
              <Text className="mt-0.5 font-inter text-[9px] leading-4 text-ink-muted">
                {option.description}
              </Text>
            </Pressable>
          );
        })}
      </View>

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

      <View className="mt-5 gap-4">
        <Field label="Full name" error={errors.fullName} required>
          <Input
            value={fullName}
            onChangeText={setFullName}
            autoComplete="name"
            placeholder="Amara Okafor"
            invalid={Boolean(errors.fullName)}
          />
        </Field>

        {role === "employer" ? (
          <Field
            label="Company name"
            error={errors.companyName}
            hint="This appears on your employer workspace and the public logo marquee."
            required
          >
            <Input
              value={companyName}
              onChangeText={setCompanyName}
              autoComplete="organization"
              placeholder="Northwind Labs"
              invalid={Boolean(errors.companyName)}
            />
          </Field>
        ) : null}

        <Field
          label={role === "employer" ? "Corporate email" : "Email"}
          error={errors.email}
          hint={
            role === "employer"
              ? "Gmail, Yahoo, Outlook, Hotmail, and iCloud addresses are blocked."
              : undefined
          }
          required
        >
          <Input
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder={role === "employer" ? "you@company.com" : "you@example.com"}
            invalid={Boolean(errors.email)}
          />
        </Field>

        <Field
          label="Password"
          error={errors.password}
          hint="At least 8 characters, with a letter and a number."
          required
        >
          <View className="flex-row items-center">
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="new-password"
              placeholder="Create a strong password"
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
          label="Create account"
          size="lg"
          loading={pending}
          icon={<ArrowRight size={16} color="#FFFFFF" />}
          onPress={() => void handleSubmit()}
        />
      </View>

      <Text className="mt-6 text-center font-inter text-[12px] text-ink-muted">
        Already have an account?{" "}
        <Link href="/auth/sign-in" className="font-inter-semibold text-accent-indigo">
          Sign in
        </Link>
      </Text>
    </AuthShell>
  );
}
