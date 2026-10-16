import { useState } from "react";
import { Plus } from "lucide-react";

const QA = [
  { q: "Is CiviConnect free for citizens?", a: "Yes. Anyone can create an account and report problems. Officer and admin accounts are created by the city's admins." },
  { q: "What if someone already reported the same problem?", a: "If an open issue of the same kind exists within 50 metres, your report is merged into it. You still get updates, and the merged issue's priority goes up because more people are affected." },
  { q: "How is priority decided?", a: "A transparent score out of 100: how hazardous the category is, how many people reported it, how many neighbours backed it, how long it has been open, and +15 if it missed its fix-by time. You can try the formula above." },
  { q: "What stops an officer from closing an issue that isn't fixed?", a: "Closing needs a proof photo. Then citizens verify. If the original reporter, or two other neighbours, say it's still there, the issue reopens automatically with half the usual time to fix it." },
  { q: "How fast will my issue be fixed?", a: "Each category has a fix-by time: 24 hours for fallen trees, 48 for drainage and garbage, 72 for potholes and street lights. Officers are warned when a quarter of the time is left, and overdue issues are escalated." },
  { q: "Is my name shown publicly?", a: "No. Public pages and the live map show only the problem, its place and its status. Your name never appears on a shared issue link." },
  { q: "Can someone without a smartphone report a problem?", a: "Yes. City staff can register a complaint on a citizen's behalf from a phone call, walk-in, email or letter, and it is tracked exactly like any other report." },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <ul className="divide-y divide-ink/10 rounded-3xl border border-ink/10 bg-surface shadow-card">
      {QA.map(({ q, a }, i) => {
        const isOpen = open === i;
        return (
          <li key={q}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="group flex w-full items-center gap-4 px-5 py-5 text-left sm:px-6"
            >
              <span className={`flex-1 font-display text-base font-semibold transition-colors sm:text-lg ${isOpen ? "text-accent" : "group-hover:text-accent"}`}>{q}</span>
              <span className={`grid size-8 shrink-0 place-items-center rounded-full transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${isOpen ? "rotate-45 bg-accent text-white" : "bg-ink/6 text-ink/60 group-hover:bg-ink/10"}`}>
                <Plus size={17} aria-hidden />
              </span>
            </button>
            <div className="cc-acc" data-open={isOpen}>
              <div>
                <p className={`px-5 pb-5 text-ink/65 transition-all duration-500 sm:px-6 ${isOpen ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}`}>{a}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
