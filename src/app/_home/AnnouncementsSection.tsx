"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { formatDateTime } from "@/lib/format-datetime";
import { can } from "@/lib/permissions";
import { api } from "./api";
import type { AccountDetails, AnnouncementRow, AppUser, Role } from "./types";

/** Scrollable comment list with edge fades only when more content exists above/below. */
function AnnouncementCommentsScrollArea({
  commentCount,
  children,
}: {
  commentCount: number;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);

  const updateFadeEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const epsilon = 4;
    const hasOverflow = scrollHeight > clientHeight + epsilon;
    if (!hasOverflow) {
      setShowTopFade(false);
      setShowBottomFade(false);
      return;
    }
    setShowTopFade(scrollTop > epsilon);
    setShowBottomFade(scrollTop + clientHeight < scrollHeight - epsilon);
  }, []);

  useLayoutEffect(() => {
    updateFadeEdges();
    const id = requestAnimationFrame(() => updateFadeEdges());
    return () => cancelAnimationFrame(id);
  }, [updateFadeEdges, commentCount]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateFadeEdges());
    ro.observe(el);
    window.addEventListener("resize", updateFadeEdges);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateFadeEdges);
    };
  }, [updateFadeEdges]);

  return (
    <div className="relative overflow-hidden rounded-md border border-neutral-200/80 bg-white/90 dark:border-slate-600 dark:bg-slate-900/40">
      {showTopFade && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-slate-900/18 via-slate-900/6 to-transparent dark:from-black/60 dark:via-black/25"
          aria-hidden
        />
      )}
      <div
        ref={scrollRef}
        onScroll={updateFadeEdges}
        className="max-h-40 overflow-y-auto overscroll-contain pr-1"
      >
        {children}
      </div>
      {showBottomFade && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-slate-900/18 via-slate-900/6 to-transparent dark:from-black/60 dark:via-black/25"
          aria-hidden
        />
      )}
    </div>
  );
}

export function AnnouncementsSection({
  user,
  accountDetails,
  announcements,
  canComment,
  onRefresh,
}: {
  user: AppUser;
  accountDetails: AccountDetails | null;
  announcements: AnnouncementRow[];
  canComment: boolean;
  onRefresh: () => Promise<void>;
}) {
  const effectiveRole: Role = accountDetails?.role ?? user.role;
  const canPostAnnouncements = can(effectiveRole, "announcements.post");
  const canDeleteAnnouncements = can(effectiveRole, "announcements.delete");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [postErr, setPostErr] = useState("");
  const [createAnnouncementOpen, setCreateAnnouncementOpen] = useState(false);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [commentsOpen, setCommentsOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!createAnnouncementOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCreateAnnouncementOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createAnnouncementOpen]);

  return (
    <section className="mb-4 rounded-xl bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Announcements</h2>
        {canPostAnnouncements && (
          <button
            type="button"
            className="btn-accent rounded-lg px-4 py-2 text-sm font-medium"
            onClick={() => {
              setPostErr("");
              setCreateAnnouncementOpen(true);
            }}
          >
            Create Announcement
          </button>
        )}
      </div>

      {createAnnouncementOpen && canPostAnnouncements && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-announcement-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCreateAnnouncementOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg rounded-xl border bg-card p-5 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="create-announcement-title" className="mb-3 text-lg font-semibold">
              Post an update
            </h3>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setPostErr("");
                try {
                  await api("/api/announcements", {
                    method: "POST",
                    body: JSON.stringify({ title, body }),
                  });
                  setTitle("");
                  setBody("");
                  setCreateAnnouncementOpen(false);
                  await onRefresh();
                } catch (err) {
                  setPostErr((err as Error).message);
                }
              }}
            >
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                className="w-full rounded-lg border bg-background p-3"
                required
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Message to your team..."
                rows={4}
                className="w-full rounded-lg border bg-background p-3"
                required
              />
              {postErr && <p className="text-sm text-rose-600">{postErr}</p>}
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="rounded-lg border px-4 py-2 text-sm font-medium"
                  onClick={() => setCreateAnnouncementOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-accent rounded-lg px-4 py-2 text-sm font-medium">
                  Publish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {announcements.length === 0 && (
          <p className="text-sm opacity-70">No announcements yet.</p>
        )}
        {announcements.map((a) => (
          <article key={a.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{a.title}</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{a.body}</p>
                <p className="mt-2 text-xs opacity-70">
                  {a.authorName} • {formatDateTime(a.createdAt)}
                </p>
              </div>
              {canDeleteAnnouncements && (
                <button
                  type="button"
                  className="rounded-lg border px-2 py-1 text-xs text-rose-700"
                  onClick={async () => {
                    await api(`/api/announcements/${a.id}`, { method: "DELETE" });
                    await onRefresh();
                  }}
                >
                  Delete
                </button>
              )}
            </div>

            {(a.comments.length > 0 || canComment) && (
              <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-600">
                <button
                  type="button"
                  className="text-sm font-medium text-blue-600 underline decoration-blue-600/40 underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  onClick={() =>
                    setCommentsOpen((prev) => ({ ...prev, [a.id]: !prev[a.id] }))
                  }
                >
                  {commentsOpen[a.id] ? "Hide comments" : "Show comments"}
                  {a.comments.length > 0 ? ` (${a.comments.length})` : ""}
                </button>

                {commentsOpen[a.id] && (
                  <div className="mt-3 rounded-lg border border-neutral-200 bg-[#f7f7f7] p-3 text-black shadow-inner dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-100 dark:shadow-inner dark:shadow-black/30">
                    {a.comments.length > 0 && (
                      <AnnouncementCommentsScrollArea commentCount={a.comments.length}>
                        <ul className="divide-y divide-neutral-200 dark:divide-slate-600">
                          {a.comments.map((c) => (
                            <li
                              key={c.id}
                              className="flex flex-col gap-0.5 px-2 py-2 text-sm"
                            >
                              <p
                                className="line-clamp-1 min-w-0 break-words text-black dark:text-slate-50"
                                title={c.body}
                              >
                                {c.body}
                              </p>
                              <p className="text-xs text-neutral-600 dark:text-slate-400">
                                {c.userName} • {formatDateTime(c.createdAt)}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </AnnouncementCommentsScrollArea>
                    )}

                    {canComment && (
                      <form
                        className={`flex flex-col gap-2 sm:flex-row ${a.comments.length > 0 ? "mt-3 border-t border-neutral-200 pt-3 dark:border-slate-600" : ""}`}
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const text = (commentText[a.id] ?? "").trim();
                          if (!text) return;
                          await api(`/api/announcements/${a.id}/comments`, {
                            method: "POST",
                            body: JSON.stringify({ body: text }),
                          });
                          setCommentText((prev) => ({ ...prev, [a.id]: "" }));
                          await onRefresh();
                        }}
                      >
                        <input
                          value={commentText[a.id] ?? ""}
                          onChange={(e) =>
                            setCommentText((prev) => ({ ...prev, [a.id]: e.target.value }))
                          }
                          placeholder="Add a comment..."
                          className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white p-3 text-black placeholder:text-neutral-500 dark:border-slate-500 dark:bg-slate-900/80 dark:text-slate-100 dark:placeholder:text-slate-400"
                        />
                        <button type="submit" className="btn-accent shrink-0 rounded-lg px-4 py-3 sm:py-2">
                          Comment
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
