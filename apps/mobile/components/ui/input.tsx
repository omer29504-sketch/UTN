import { TextInput, type TextInputProps } from "react-native";

import { cn } from "@/lib/cn";

export interface InputProps extends TextInputProps {
  invalid?: boolean;
}

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <TextInput
      placeholderTextColor="#94A3B8"
      className={cn(
        "min-h-[44px] rounded-xl border bg-white px-3.5 py-2.5 font-inter text-[13px] text-ink-primary",
        invalid ? "border-danger" : "border-line",
        className,
      )}
      {...props}
    />
  );
}
