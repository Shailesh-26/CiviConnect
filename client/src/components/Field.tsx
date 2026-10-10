import { useId, useState } from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  hint?: string;
  error?: string;
  icon?: LucideIcon;
};

export function Field({ label, value, onChange, type = "text", autoComplete, hint, error, icon: Icon }: Props) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const isPassword = type === "password";

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="relative mt-1.5">
        {Icon && <Icon size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" aria-hidden />}
        <input
          id={id}
          type={isPassword && shown ? "text" : type}
          value={value}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`input ${Icon ? "!pl-10" : ""} ${isPassword ? "!pr-11" : ""}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-ink/50 hover:bg-ink/5 hover:text-ink"
          >
            {shown ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
          </button>
        )}
      </div>
      {error ? <p className="mt-1.5 text-sm text-alert">{error}</p> : hint ? <p className="mt-1.5 text-xs text-ink/55">{hint}</p> : null}
    </div>
  );
}
