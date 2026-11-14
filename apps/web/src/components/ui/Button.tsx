import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "soft";
export type ButtonSize = "sm" | "md" | "lg" | "touch";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pending?: boolean;
  /** An icon before the label; the spinner takes its place while pending, so the button keeps its width. */
  icon?: ReactNode;
  /** An icon or keyboard hint after the label. */
  trailing?: ReactNode;
};

/** The look lives in globals.css (`.btn-*`), so a raw `className="btn-secondary"` and a <Button> are the same button. */
export const BUTTON_VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  danger: "btn-danger",
  ghost: "btn-ghost",
  soft: "btn-soft",
};

export const BUTTON_SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "btn-sm",
  md: "btn-md",
  lg: "btn-lg",
  /** Thumb-sized: 44 px tall, for screens used on a phone (Phase 44). */
  touch: "btn-touch",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", pending = false, icon, trailing, disabled, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(BUTTON_VARIANT_CLASS[variant], BUTTON_SIZE_CLASS[size], className)}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending ? <Spinner /> : icon}
      {children}
      {trailing}
    </button>
  );
});

/** A keyboard hint shown inside a button or menu item (`<Kbd>⌘K</Kbd>`). */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn("rounded border border-current/25 px-1 font-sans text-[10px] font-medium leading-4 opacity-70", className)}>{children}</kbd>
  );
}
