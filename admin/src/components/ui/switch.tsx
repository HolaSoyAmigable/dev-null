import type { InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";

import { cn } from "@/lib/utils";

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role"> & {
  label: string;
  hint?: ReactNode;
};

/** Interruptor accesible (checkbox con `role="switch"`) compatible con `register` de react-hook-form. */
export function Switch({ label, hint, className, id, ...props }: SwitchProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = `${inputId}-hint`;
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        id={inputId}
        type="checkbox"
        role="switch"
        aria-describedby={hint ? hintId : undefined}
        className="relative mt-0.5 h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full border border-border bg-surface-2 transition-colors before:absolute before:left-0.5 before:top-0.5 before:size-3.5 before:rounded-full before:bg-muted before:transition-transform checked:border-accent checked:bg-accent checked:before:translate-x-4 checked:before:bg-accent-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
      <div className="min-w-0">
        <label htmlFor={inputId} className="block cursor-pointer text-sm font-medium text-fg">
          {label}
        </label>
        {hint ? (
          <p id={hintId} className="text-xs text-muted">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
