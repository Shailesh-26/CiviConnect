import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, CornerDownRight, EyeOff, Flag, ImagePlus, MessageSquare, Pin, Send, Trash2, X } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { api, ApiError } from "../lib/api";
import { timeAgo } from "../lib/format";
import { useToast } from "../lib/toast-context";
import type { IssueComment } from "../types";
import { ActionMenu } from "./ActionMenu";
import { Avatar } from "./Avatar";
import { ConfirmDialog } from "./ConfirmDialog";
import { FlagDialog } from "./FlagDialog";

function CommentBox({
  placeholder,
  autoFocus,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  autoFocus?: boolean;
  onSubmit: (body: string, files: File[]) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  async function send() {
    if (!body.trim() || busy) return;
    setBusy(true);
    const ok = await onSubmit(body.trim(), files);
    setBusy(false);
    if (ok) {
      setBody("");
      setFiles([]);
    }
  }

  if (!user) return null;
  return (
    <div className="flex gap-3">
      <Avatar name={user.name} avatar={user.avatar} size="sm" />
      <div className="min-w-0 flex-1 rounded-2xl border border-ink/12 bg-surface transition focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--c-accent)_20%,transparent)]">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send();
          }}
          autoFocus={autoFocus}
          rows={2}
          maxLength={1000}
          placeholder={placeholder}
          className="block w-full resize-none rounded-2xl bg-transparent px-4 pt-3 text-sm outline-none placeholder:text-ink/40"
        />
        {previews.length > 0 && (
          <div className="flex gap-2 px-4 pt-2">
            {previews.map((src, i) => (
              <div key={src} className="relative size-16 overflow-hidden rounded-lg border border-ink/15">
                <img src={src} alt="" className="size-full object-cover" />
                <button type="button" aria-label="Remove photo" onClick={() => setFiles((f) => f.filter((_, k) => k !== i))} className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-black/70 text-white">
                  <X size={12} aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 px-2 pb-2 pt-1">
          {files.length < 2 && (
            <label className="grid size-9 cursor-pointer place-items-center rounded-xl text-ink/50 transition hover:bg-ink/6 hover:text-ink" title="Add a photo as evidence">
              <ImagePlus size={18} aria-hidden />
              <span className="sr-only">Add photo</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  setFiles((f) => [...f, ...picked].slice(0, 2));
                  e.target.value = "";
                }}
              />
            </label>
          )}
          <span className="hidden text-[11px] text-ink/40 sm:inline">Ctrl + Enter to send</span>
          <span className="ml-auto text-[11px] tabular-nums text-ink/40">{body.length}/1000</span>
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn btn-ghost !px-3 !py-1.5 text-xs">Cancel</button>
          )}
          <button type="button" onClick={send} disabled={!body.trim() || busy} className="btn btn-primary !px-3.5 !py-1.5 text-xs">
            <Send size={14} aria-hidden /> {busy ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CommentView({
  comment,
  onReply,
  onDelete,
  onFlag,
  compact = false,
}: {
  comment: IssueComment;
  onReply?: () => void;
  onDelete: () => void;
  onFlag: () => void;
  compact?: boolean;
}) {
  const [reveal, setReveal] = useState(false);
  const author = comment.author;

  if (comment.deleted) {
    return <p className="rounded-xl bg-ink/4 px-3 py-2 text-xs italic text-ink/45">This comment was deleted.</p>;
  }

  const concealed = comment.body === null;
  const showBody = !comment.hidden || reveal || concealed;

  return (
    <div className={`flex gap-3 ${compact ? "" : "animate-fade"}`}>
      {author && <Avatar name={author.name} avatar={author.avatar} size={compact ? "xs" : "sm"} />}
      <div className={`min-w-0 flex-1 rounded-2xl px-4 py-3 ${comment.official ? "border border-accent/30 bg-accent/8" : "bg-ink/4"}`}>
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">{author?.name ?? "Someone"}</span>
            {comment.official && author && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-paper">
                <BadgeCheck size={11} aria-hidden /> {author.role === "admin" ? "City office" : author.department ?? "Officer"}
              </span>
            )}
            {comment.isMine && <span className="ml-2 text-xs text-ink/45">(you)</span>}
            <span className="ml-2 text-xs text-ink/45">{timeAgo(comment.createdAt)}</span>
          </p>
          <ActionMenu
            label="Comment actions"
            items={[
              { label: "Delete comment", icon: Trash2, onSelect: onDelete, danger: true, hidden: !comment.canDelete },
              { label: comment.flaggedByMe ? "Already reported" : "Report comment", icon: Flag, onSelect: () => !comment.flaggedByMe && onFlag(), danger: true, hidden: comment.isMine },
            ]}
          />
        </div>
        {concealed ? (
          <p className="mt-1 flex items-center gap-1.5 text-sm italic text-ink/50"><EyeOff size={14} aria-hidden /> Hidden after several community reports. An admin will review it.</p>
        ) : showBody ? (
          <>
            {comment.hidden && <p className="mt-1 text-xs font-medium text-alert">Hidden from others after community reports</p>}
            <p className="mt-1 whitespace-pre-line break-words text-sm text-ink/85">{comment.body}</p>
            {comment.images.length > 0 && (
              <div className="mt-2 flex gap-2">
                {comment.images.map((img) => (
                  <a key={img.url} href={img.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-ink/15">
                    <img src={img.url} alt="Evidence" loading="lazy" className="h-24 object-cover transition-transform hover:scale-105" />
                  </a>
                ))}
              </div>
            )}
          </>
        ) : (
          <button type="button" onClick={() => setReveal(true)} className="mt-1 text-xs font-medium text-accent">Show hidden comment</button>
        )}
        {onReply && (
          <button type="button" onClick={onReply} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-ink/55 hover:text-accent">
            <CornerDownRight size={13} aria-hidden /> Reply
          </button>
        )}
      </div>
    </div>
  );
}

// The thread under an issue: neighbours add details and evidence, officers post official updates.
export function Discussion({ issueId, onCountChange }: { issueId: string; onCountChange?: (delta: number) => void }) {
  const toast = useToast();
  const [comments, setComments] = useState<IssueComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<IssueComment | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);
  const [flagging, setFlagging] = useState<IssueComment | null>(null);
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    api<{ comments: IssueComment[] }>(`/issues/${issueId}/comments`)
      .then((data) => active && setComments(data.comments))
      .catch((err) => active && setError(err instanceof ApiError ? err.message : "Could not load the discussion"));
    return () => {
      active = false;
    };
  }, [issueId]);

  useEffect(() => {
    if (comments && window.location.hash === "#discussion") section.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [comments]);

  async function post(body: string, files: File[], parentId?: string) {
    const form = new FormData();
    form.append("body", body);
    if (parentId) form.append("parentId", parentId);
    files.forEach((f) => form.append("photos", f));
    try {
      const data = await api<{ comment: IssueComment }>(`/issues/${issueId}/comments`, { method: "POST", body: form });
      setComments((all) => [...(all ?? []), data.comment]);
      setReplyTo(null);
      onCountChange?.(1);
      toast.success(data.comment.official ? "Posted as an official update." : "Your comment is live. You now follow this issue.", { title: "Posted" });
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not post. Try again.");
      return false;
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusyDelete(true);
    try {
      await api(`/comments/${deleting.id}`, { method: "DELETE" });
      setComments((all) => (all ?? []).map((c) => (c.id === deleting.id ? { ...c, deleted: true, body: null, images: [] } : c)));
      onCountChange?.(-1);
      toast.success("Comment deleted.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete. Try again.");
    } finally {
      setBusyDelete(false);
      setDeleting(null);
    }
  }

  const top = (comments ?? []).filter((c) => !c.parentId);
  const repliesOf = (id: string) => (comments ?? []).filter((c) => c.parentId === id);
  const visibleTop = top.filter((c) => !c.deleted || repliesOf(c.id).length > 0);
  const pinned = [...(comments ?? [])].reverse().find((c) => c.official && !c.deleted && c.body);
  const count = (comments ?? []).filter((c) => !c.deleted).length;

  return (
    <section id="discussion" ref={section} className="card scroll-mt-24 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <MessageSquare size={19} className="text-accent" aria-hidden /> Discussion
        {comments && <span className="rounded-full bg-ink/8 px-2 text-sm font-medium tabular-nums text-ink/60">{count}</span>}
      </h2>
      <p className="mt-1 text-sm text-ink/55">Add details, a photo of how it looks now, or ask the officer. Keep it about the problem.</p>

      {pinned && (
        <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/8 p-1">
          <p className="flex items-center gap-1.5 px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-accent"><Pin size={12} aria-hidden /> Latest official update</p>
          <div className="p-2">
            <CommentView comment={pinned} compact onDelete={() => setDeleting(pinned)} onFlag={() => setFlagging(pinned)} />
          </div>
        </div>
      )}

      <div className="mt-5">
        <CommentBox placeholder="Add to the discussion…" onSubmit={(body, files) => post(body, files)} />
      </div>

      {error ? (
        <p className="mt-4 text-sm text-alert">{error}</p>
      ) : comments === null ? (
        <div className="mt-5 space-y-3">
          {[0, 1].map((i) => <div key={i} className="skeleton h-16 w-full !rounded-2xl" />)}
        </div>
      ) : visibleTop.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-ink/15 px-4 py-8 text-center text-sm text-ink/50">No comments yet. Be the first to add something useful.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {visibleTop.map((c) => (
            <li key={c.id} className="space-y-3">
              <CommentView comment={c} onReply={c.deleted ? undefined : () => setReplyTo(replyTo === c.id ? null : c.id)} onDelete={() => setDeleting(c)} onFlag={() => setFlagging(c)} />
              {(repliesOf(c.id).length > 0 || replyTo === c.id) && (
                <div className="ml-6 space-y-3 border-l-2 border-ink/10 pl-4 sm:ml-12">
                  {repliesOf(c.id).map((r) => (
                    <CommentView key={r.id} comment={r} compact onDelete={() => setDeleting(r)} onFlag={() => setFlagging(r)} />
                  ))}
                  {replyTo === c.id && (
                    <CommentBox placeholder={`Reply to ${c.author?.name ?? "this comment"}…`} autoFocus onCancel={() => setReplyTo(null)} onSubmit={(body, files) => post(body, files, c.id)} />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        icon={Trash2}
        tone="danger"
        title="Delete this comment?"
        message="It will be replaced with “This comment was deleted” for everyone. This cannot be undone."
        confirmLabel="Delete"
        busy={busyDelete}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
      <FlagDialog
        open={Boolean(flagging)}
        endpoint={flagging ? `/comments/${flagging.id}/flag` : ""}
        what="comment"
        onClose={() => setFlagging(null)}
        onDone={() => {
          if (flagging) setComments((all) => (all ?? []).map((c) => (c.id === flagging.id ? { ...c, flaggedByMe: true } : c)));
          setFlagging(null);
        }}
      />
    </section>
  );
}
