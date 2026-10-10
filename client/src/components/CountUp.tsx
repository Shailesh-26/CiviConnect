import { useCountUp } from "../lib/useCountUp";

export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const shown = useCountUp(value);
  return (
    <span className="tabular-nums">
      {shown.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}
