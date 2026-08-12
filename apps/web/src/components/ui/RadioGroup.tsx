import { type ReactNode } from "react";

export function RadioGroup({
  name,
  label,
  value,
  onChange,
  options,
  required,
  disabled,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="space-y-2">
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                required={required}
                disabled={disabled}
                onChange={() => onChange(option.value)}
                className="h-4 w-4 accent-brand-600"
              />
              <span className={disabled ? "opacity-60" : undefined}>{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
