import { useId, useState } from "react";

// Common municipal departments. Their names contain the words smart routing looks for
// (road, sanit, drain, light, tree, park...), so issues reach the right officer.
const STANDARD_DEPARTMENTS = ["Roads and Pavements", "Sanitation", "Drainage", "Street Lighting", "Parks and Trees", "Drainage and Trees", "Ward Office"];
const NEW = "__new__";

// Pick a department from the list, or choose "Add a new department" and type one.
export function DepartmentPicker({ value, onChange, existing = [], error, label = "Department" }: { value: string; onChange: (v: string) => void; existing?: string[]; error?: string; label?: string }) {
  const id = useId();
  const options = [...new Set([...STANDARD_DEPARTMENTS, ...existing.filter(Boolean)])].sort((a, b) => a.localeCompare(b));
  const [typing, setTyping] = useState(() => Boolean(value) && !options.includes(value));
  const selected = typing ? NEW : value;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <select
        id={id}
        value={selected}
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          if (e.target.value === NEW) {
            setTyping(true);
            onChange("");
          } else {
            setTyping(false);
            onChange(e.target.value);
          }
        }}
        className="input mt-1.5"
      >
        <option value="" disabled>Choose a department</option>
        {options.map((d) => <option key={d} value={d}>{d}</option>)}
        <option value={NEW}>+ Add a new department…</option>
      </select>
      {typing && (
        <input autoFocus value={value} onChange={(e) => onChange(e.target.value)} maxLength={80} placeholder="New department name, e.g. Water Supply" aria-label="New department name" className="input mt-2 animate-fade" />
      )}
      {error ? <p className="mt-1.5 text-sm text-alert">{error}</p> : <p className="mt-1.5 text-xs text-ink/55">Used for smart routing: issues go to officers whose department matches the problem.</p>}
    </div>
  );
}
