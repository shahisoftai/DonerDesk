import { forwardRef, type InputHTMLAttributes } from "react";

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Checkbox(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={`h-4 w-4 rounded border-slate-300 text-brand-600 accent-brand-600 focus:ring-brand-500 ${className ?? ""}`}
      {...props}
    />
  );
});
