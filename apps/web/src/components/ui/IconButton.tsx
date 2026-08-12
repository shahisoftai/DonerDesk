import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, className, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-300 bg-white/70 text-slate-600 shadow-sm backdrop-blur transition hover:border-brand-400 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-slate-300 dark:hover:border-brand-400/60 dark:hover:text-brand-300",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
