import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowBigUp, Bell, BellRing, EyeOff, Flag, Layers, Link2, MapPin, MessageSquare, Share2, Users } from "lucide-react";
import { formatDistance } from "../lib/community";
import { issueLabel, OPEN, STATUS_META } from "../lib/constants";
import { timeAgo } from "../lib/format";
import { useIssueActions } from "../lib/useIssueActions";
import type { FeedItem } from "../types";
import { ActionMenu } from "./ActionMenu";
import { CategoryChip } from "./CategoryChip";
import { StatusBadge } from "./StatusBadge";

type Props = {
  item: FeedItem;
  active: boolean;
  index: number;
  onHover: (id: string | null) => void;
  onChange: (item: FeedItem) => void;
  onHide: (item: FeedItem) => void;
  onFlag: (item: FeedItem) => void;
};

// One thread on the Neighbourhood board. Every action has a civic effect:
// upvote = "this affects me too" (raises priority), follow = updates, flag = admin review.
export function FeedCard({ item, active, index, onHover, onChange, onHide, onFlag }: Props) {
  const navigate = useNavigate();
  const actions = useIssueActions();
  const [bump, setBump] = useState(0);
  const open = OPEN.includes(item.status);
  const label = issueLabel(item);
  const image = item.images[0]?.url;
  const update = item.latestUpdate && item.latestUpdate.status !== "reported" ? item.latestUpdate : null;

  async function upvote() {
    if (!open) return;
    const optimistic = { ...item, supportedByMe: !item.supportedByMe, supporterCount: item.supporterCount + (item.supportedByMe ? -1 : 1) };
    onChange(optimistic);
    setBump((b) => b + 1);
    try {
      const fresh = await actions.support(item);
      onChange({ ...optimistic, supporterCount: fresh.supporterCount, supportedByMe: fresh.supportedByMe, priority: fresh.priority, priorityLabel: fresh.priorityLabel });
    } catch (err) {
      onChange(item);
      actions.fail(err);
    }
  }

  async function toggleFollow() {
    try {
      const following = await actions.follow(item);
      onChange({ ...item, followedByMe: following });
    } catch (err) {
      actions.fail(err);
    }
  }

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <article
      onMouseEnter={() => onHover(item.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => navigate(`/issues/${item.id}`)}
      style={{ animationDelay: `${Math.min(index, 6) * 50}ms` }}
      className={`card group flex cursor-pointer overflow-visible transition duration-200 animate-rise hover:-translate-y-0.5 hover:shadow-lift ${active ? "border-accent/50 shadow-lift" : ""}`}
    >
      <div className="flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-l-2xl bg-ink/[0.035] py-4 sm:w-16">
        <button
          type="button"
          onClick={stop(upvote)}
          disabled={!open}
          aria-pressed={item.supportedByMe}
          aria-label={item.supportedByMe ? "Remove your support" : "This affects me too"}
          title={open ? "This affects me too" : "Closed issues cannot be supported"}
          className={`grid size-10 place-items-center rounded-xl transition ${item.supportedByMe ? "bg-marker/25 text-marker-dark" : "text-ink/45 hover:bg-marker/15 hover:text-marker-dark"} disabled:cursor-default disabled:opacity-50`}
        >
          <ArrowBigUp key={bump} size={26} className={bump ? "animate-pop" : ""} fill={item.supportedByMe ? "currentColor" : "none"} aria-hidden />
        </button>
        <span className={`font-display text-lg font-bold tabular-nums ${item.supportedByMe ? "text-marker-dark" : ""}`}>{item.supporterCount}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-ink/45">affected</span>
      </div>

      <div className="min-w-0 flex-1 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <CategoryChip category={item.category} icon={item.customIcon} size="sm" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-lg font-semibold leading-tight group-hover:text-accent">{label}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink/55">
              <span className="inline-flex items-center gap-1 font-medium text-ink/70"><MapPin size={12} aria-hidden /> {formatDistance(item.distanceM)}</span>
              <span>{timeAgo(item.createdAt)}</span>
              <span className="tabular-nums">{item.ticket}</span>
              <span className="sm:hidden"><StatusBadge status={item.status} /></span>
            </p>
          </div>
          <span className="hidden sm:block"><StatusBadge status={item.status} /></span>
          <ActionMenu
            items={[
              { label: "Copy link", icon: Link2, onSelect: () => actions.copyLink(item) },
              { label: "Share", icon: Share2, onSelect: () => actions.share(item) },
              { label: item.followedByMe ? "Stop following" : "Follow for updates", icon: item.followedByMe ? BellRing : Bell, onSelect: toggleFollow },
              { label: item.supportedByMe ? "Remove “affects me”" : "I am also affected", icon: Users, onSelect: upvote, hidden: !open },
              { label: "Hide from my feed", icon: EyeOff, onSelect: () => onHide(item) },
              { label: item.flaggedByMe ? "Already reported" : "Report to admins", icon: Flag, onSelect: () => !item.flaggedByMe && onFlag(item), danger: true },
            ]}
          />
        </div>

        {item.address && <p className="mt-3 text-sm font-medium text-ink/80">{item.address}</p>}
        <p className="mt-1 line-clamp-3 text-sm text-ink/70">{item.description}</p>

        {image && (
          <div className="mt-3 overflow-hidden rounded-xl border border-ink/10">
            <img src={image} alt={`Photo of ${label}`} loading="lazy" className="aspect-[16/8] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          </div>
        )}

        {update && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-accent/8 px-3 py-2 text-xs text-ink/75">
            <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: STATUS_META[update.status].hex }} aria-hidden />
            <span className="line-clamp-2">
              <span className="font-semibold">{STATUS_META[update.status].label}</span>
              {update.note ? ` · ${update.note}` : ""} <span className="text-ink/50">· {timeAgo(update.at)}</span>
            </span>
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1 text-sm text-ink/60">
          <button type="button" onClick={stop(() => navigate(`/issues/${item.id}#discussion`))} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition hover:bg-ink/6 hover:text-ink">
            <MessageSquare size={16} aria-hidden /> {item.commentCount} {item.commentCount === 1 ? "comment" : "comments"}
          </button>
          <button type="button" onClick={stop(() => actions.share(item))} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition hover:bg-ink/6 hover:text-ink">
            <Share2 size={16} aria-hidden /> Share
          </button>
          <button
            type="button"
            onClick={stop(toggleFollow)}
            aria-pressed={item.followedByMe}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition hover:bg-ink/6 ${item.followedByMe ? "text-accent" : "hover:text-ink"}`}
          >
            {item.followedByMe ? <BellRing size={16} aria-hidden /> : <Bell size={16} aria-hidden />} {item.followedByMe ? "Following" : "Follow"}
          </button>
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-ink/50">
            <Layers size={13} aria-hidden /> {item.reportCount} {item.reportCount === 1 ? "report" : "reports"}
          </span>
        </div>
      </div>
    </article>
  );
}
