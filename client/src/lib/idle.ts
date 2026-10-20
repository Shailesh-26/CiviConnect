// Inactivity logout: after IDLE_MINUTES with no mouse, keyboard, touch or scrolling in any tab, a
// popup asks "Are you still there?" and counts down WARNING_SECONDS before logging out.
// The server allows a few minutes more (SESSION_IDLE_MINUTES in server/.env) as its own safety net.
export const IDLE_MINUTES = 15;
export const WARNING_SECONDS = 60;

// Shared between tabs through localStorage, so activity in one tab keeps every tab alive.
export const ACTIVITY_KEY = "cc:last-activity";
export const IDLE_LOGOUT_KEY = "cc:idle-logout";

// How many open forms have unsaved changes right now (kept up to date by useLeaveGuard).
export const unsavedWork = { count: 0 };
