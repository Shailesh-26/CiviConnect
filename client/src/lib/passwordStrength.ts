export function passwordScore(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Za-z]/.test(password) && /\d/.test(password)) score++;
  if (password.length >= 12) score++;
  if (/[^A-Za-z0-9]/.test(password) && /[A-Z]/.test(password)) score++;
  return score;
}

export const STRENGTH_LEVELS = [
  { label: "Too short", color: "bg-alert" },
  { label: "Weak", color: "bg-alert" },
  { label: "Okay", color: "bg-marker" },
  { label: "Good", color: "bg-resolved" },
  { label: "Strong", color: "bg-resolved" },
];
