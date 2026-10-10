import { PRIORITY_META } from "./constants";
import type { Issue } from "../types";

// Pin colour on the explore map: priority while open, green when fixed, grey when rejected.
export const pinColor = (i: Issue) => (i.status === "resolved" ? "#2e7d5b" : i.status === "rejected" ? "#6b7280" : PRIORITY_META[i.priorityLabel].hex);
