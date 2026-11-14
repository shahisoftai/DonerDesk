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
        "btn-secondary h-10 w-10 shrink-0 p-0 text-slate-600 dark:text-slate-300",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
