import { useId } from "react";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  hint?: string;
  error?: string;
};

export function Field({ label, value, onChange, type = "text", autoComplete, hint, error }: Props) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-ink/25 bg-white px-3 py-2 focus:outline-2 focus:outline-signboard aria-invalid:border-alert"
      />
      {error ? (
        <p className="mt-1 text-sm text-alert">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink/60">{hint}</p>
      ) : null}
    </div>
  );
}
