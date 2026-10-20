import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Award, ArrowRight, ChevronDown, FilePlus2, Map as MapIcon, Radar, Radio } from "lucide-react";
import { useAuth } from "../../auth/useAuth";
import { Logo } from "../Logo";
import { ThemeToggle } from "../ThemeToggle";

// Logged out, each item scrolls to the part of this page that shows it (and flashes it).
// Logged in, it opens the real page in the app.
const PRODUCT = [
  { icon: FilePlus2, title: "Report wizard", text: "Photo, pin, details. Done in under a minute.", tone: "bg-marker/20 text-marker-dark", target: "roles", role: "citizen", app: "/report" },
  { icon: Radar, title: "Neighbourhood", text: "Everything reported within 2 km of you.", tone: "bg-accent/12 text-accent", target: "live-feed", app: "/neighbourhood" },
  { icon: MapIcon, title: "Explore the city", text: "Clusters, heat and live pins on one map.", tone: "bg-resolved/15 text-resolved", target: "live-map", app: "/map" },
  { icon: Award, title: "Area report cards", text: "Every ward graded on how fast it fixes things.", tone: "bg-alert/10 text-alert", target: "report-cards", app: "/insights" },
];

// Scrolls to a section even if the address already ends in that #hash, then briefly outlines it.
function scrollToSection(id: string, role?: string) {
  const el = document.getElementById(id);
  if (!el) return;
  if (role) window.dispatchEvent(new CustomEvent("cc:show-role", { detail: role }));
  el.scrollIntoView({ behavior: "smooth", block: id === "roles" ? "start" : "center" });
  history.replaceState(null, "", `#${id}`);
  const flashed = id === "roles" ? el.querySelector<HTMLElement>(".shadow-lift") ?? el : el;
  flashed.classList.remove("cc-flash");
  window.setTimeout(() => flashed.classList.add("cc-flash"), 450);
  window.setTimeout(() => flashed.classList.remove("cc-flash"), 2400);
}

const LINKS = [
  { href: "#roles", label: "Who it's for" },
  { href: "#how", label: "How it works" },
  { href: "#live", label: "Live city" },
  { href: "#faq", label: "FAQ" },
];

const SECTIONS = ["features", "roles", "how", "live", "faq"];

export function LandingHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("");
  const [menu, setMenu] = useState(false);
  const [product, setProduct] = useState(false);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const closeTimer = useRef(0);

  // Scroll: one rAF per frame drives the progress bar directly (no re-render) and flips `scrolled` only when it changes.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
      setScrolled((prev) => (prev === y > 16 ? prev : y > 16));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Highlight the nav link of the section in the middle of the screen.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const id of SECTIONS) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menu]);

  const openProduct = () => {
    window.clearTimeout(closeTimer.current);
    setProduct(true);
  };
  const closeProduct = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setProduct(false), 140);
  };
  const hoverLink = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    setPill({ x: el.offsetLeft, w: el.offsetWidth });
  };

  return (
    <header className="fixed inset-x-0 top-0 z-[2000] px-3 pt-3 sm:px-4">
      <div onClick={() => setMenu(false)} className={`fixed inset-0 -z-10 bg-ink/25 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden ${menu ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden />
      <div className={`cc-island mx-auto flex items-center justify-between gap-3 ${scrolled ? "is-scrolled" : ""}`}>
        <Logo />

        <nav className="relative hidden items-center lg:flex" onMouseLeave={() => setPill(null)} aria-label="Main">
          <span
            className="pointer-events-none absolute inset-y-1 rounded-full bg-ink/7 transition-[transform,width,opacity] duration-300 ease-[cubic-bezier(.22,1,.36,1)]"
            style={{ transform: `translateX(${pill?.x ?? 0}px)`, width: pill?.w ?? 0, opacity: pill ? 1 : 0 }}
            aria-hidden
          />
          <div className="relative" onMouseEnter={openProduct} onMouseLeave={closeProduct}>
            <button
              type="button"
              onMouseEnter={hoverLink}
              onFocus={openProduct}
              onClick={() => setProduct((v) => !v)}
              aria-expanded={product}
              className={`relative flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${active === "features" ? "text-accent" : "text-ink/75 hover:text-ink"}`}
            >
              Product <ChevronDown size={15} className={`transition-transform duration-300 ${product ? "rotate-180" : ""}`} aria-hidden />
            </button>
            <div className="cc-menu absolute left-1/2 top-full w-[34rem] pt-3" data-open={product}>
              <div className="grid grid-cols-[1fr_12rem] gap-2 rounded-3xl border border-ink/10 bg-surface/95 p-2 shadow-lift backdrop-blur-xl">
                <ul className="grid gap-1">
                  {PRODUCT.map(({ icon: Icon, title, text, tone, target, role, app }, i) => (
                    <li key={title} className="cc-menu-item" style={{ transitionDelay: product ? `${60 + i * 35}ms` : "0ms" }}>
                      <a
                        href={user ? app : `#${target}`}
                        onClick={(e) => {
                          e.preventDefault();
                          setProduct(false);
                          if (user) navigate(app);
                          else scrollToSection(target, role);
                        }}
                        className="group flex gap-3 rounded-2xl p-3 transition-colors hover:bg-ink/5"
                      >
                        <span className={`grid size-10 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${tone}`}><Icon size={19} aria-hidden /></span>
                        <span>
                          <span className="block text-sm font-semibold">{title}</span>
                          <span className="block text-xs text-ink/55">{text}</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
                <a href="#live" onClick={(e) => { e.preventDefault(); setProduct(false); scrollToSection("live"); }} className="group relative flex flex-col justify-end overflow-hidden rounded-2xl bg-signboard p-4 text-white">
                  <span className="grid-paper absolute inset-0 opacity-30" aria-hidden />
                  <span className="absolute right-4 top-4 flex size-3">
                    <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-marker" />
                    <span className="relative inline-flex size-3 rounded-full bg-marker" />
                  </span>
                  <Radio size={22} className="relative text-marker" aria-hidden />
                  <span className="relative mt-3 font-display text-lg font-semibold leading-tight">See the city live</span>
                  <span className="relative mt-1 inline-flex items-center gap-1 text-xs text-white/70">
                    Real reports, right now <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" aria-hidden />
                  </span>
                </a>
              </div>
            </div>
          </div>
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onMouseEnter={hoverLink}
              className={`relative rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${active === l.href.slice(1) ? "text-accent" : "text-ink/75 hover:text-ink"}`}
            >
              {l.label}
              <span className={`absolute inset-x-3.5 -bottom-0.5 h-0.5 origin-left rounded-full bg-accent transition-transform duration-500 ${active === l.href.slice(1) ? "scale-x-100" : "scale-x-0"}`} aria-hidden />
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          {user ? (
            <Link to="/dashboard" className="btn btn-primary hidden sm:inline-flex">Open dashboard <ArrowRight size={16} aria-hidden /></Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost hidden sm:inline-flex">Log in</Link>
              <Link to="/register" className="btn btn-primary hidden sm:inline-flex">Get started <ArrowRight size={16} aria-hidden /></Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
            className="btn btn-ghost relative size-10 !p-0 lg:hidden"
          >
            <span className={`cc-burger ${menu ? "is-open" : ""}`} aria-hidden><i /><i /><i /></span>
          </button>
        </div>

        <div className="pointer-events-none absolute inset-x-6 bottom-0 h-px overflow-hidden rounded-full" aria-hidden>
          <div ref={bar} className="h-full origin-left bg-gradient-to-r from-accent via-marker to-resolved" style={{ transform: "scaleX(0)" }} />
        </div>
      </div>

      {/* Mobile sheet */}
      <div className="cc-sheet lg:hidden" data-open={menu}>
        <div className="mt-2 w-full rounded-3xl border border-ink/10 bg-surface/95 p-3 shadow-lift backdrop-blur-xl">
          <ul className="grid gap-1">
            {[{ href: "#features", label: "Product" }, ...LINKS].map((l, i) => (
              <li key={l.href} className="cc-menu-item" style={{ transitionDelay: menu ? `${40 + i * 45}ms` : "0ms" }}>
                <a href={l.href} onClick={() => setMenu(false)} className="flex items-center justify-between rounded-2xl px-4 py-3.5 font-display text-lg font-semibold hover:bg-ink/5">
                  {l.label} <ArrowRight size={18} className="text-ink/35" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-ink/10 pt-3">
            {user ? (
              <Link to="/dashboard" className="btn btn-primary col-span-2">Open dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-outline">Log in</Link>
                <Link to="/register" className="btn btn-primary">Get started</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
