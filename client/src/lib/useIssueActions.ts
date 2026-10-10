import { useCallback } from "react";
import { api, ApiError } from "./api";
import { copyText, publicLink, shareIssue } from "./community";
import { issueLabel } from "./constants";
import { useToast } from "./toast-context";
import type { Issue } from "../types";

// Shared actions for an issue card or thread: support, follow, share, copy link, hide.
export function useIssueActions() {
  const toast = useToast();

  const support = useCallback(
    async (issue: Pick<Issue, "id">) => {
      const data = await api<{ issue: Issue }>(`/issues/${issue.id}/support`, { method: "POST" });
      return data.issue;
    },
    [],
  );

  const follow = useCallback(
    async (issue: Pick<Issue, "id">) => {
      const data = await api<{ following: boolean }>(`/issues/${issue.id}/follow`, { method: "POST" });
      toast.info(data.following ? "You will be told about every update on this issue." : "You will no longer get updates on this issue.", {
        title: data.following ? "Following" : "Unfollowed",
      });
      return data.following;
    },
    [toast],
  );

  const share = useCallback(
    async (issue: Pick<Issue, "ticket" | "category" | "customLabel">) => {
      const result = await shareIssue(issue.ticket, issueLabel(issue));
      if (result === "copied") toast.success("Anyone with the link can see this issue, no login needed.", { title: "Link copied" });
      if (result === "failed") toast.error("Could not copy the link on this browser.");
    },
    [toast],
  );

  const copyLink = useCallback(
    async (issue: Pick<Issue, "ticket">) => {
      const result = await copyText(publicLink(issue.ticket));
      if (result === "copied") toast.success(publicLink(issue.ticket), { title: "Link copied" });
      else toast.error("Could not copy the link on this browser.");
    },
    [toast],
  );

  const hide = useCallback(async (issue: Pick<Issue, "id">) => {
    const data = await api<{ hidden: boolean }>(`/issues/${issue.id}/hide`, { method: "POST" });
    return data.hidden;
  }, []);

  const fail = useCallback(
    (err: unknown) => toast.error(err instanceof ApiError ? err.message : "Something went wrong. Try again."),
    [toast],
  );

  return { support, follow, share, copyLink, hide, fail };
}
