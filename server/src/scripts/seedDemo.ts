import mongoose, { Types } from "mongoose";
import { env } from "../config/env";
import { Comment } from "../models/Comment";
import { AuditLog } from "../models/AuditLog";
import { Flag } from "../models/Flag";
import { Notification } from "../models/Notification";
import { CATEGORIES, Issue, type Category, type Status } from "../models/Issue";
import { User } from "../models/User";
import { normaliseLabel } from "../utils/customIcons";
import { hashPassword } from "../utils/password";
import { DEFAULT_SLA_HOURS } from "../services/sla";

/**
 * Fills the database with a realistic, fully fake city so every page looks alive in a demo:
 * about 150 issues over 90 days, 20 citizens, 6 officers, discussions, flags, escalations,
 * notifications and an audit trail.
 *
 *   npm run seed:demo          (re-)create the demo data
 *   npm run seed:demo:clear    remove the demo data again
 *
 * Only demo records are touched: users with an @civiconnect.demo email and issues whose ticket
 * starts with CC-D. Your real accounts and issues are never changed. Photos are the illustrations
 * in client/public/demo, so nothing is uploaded to Cloudinary.
 */

const DEMO_DOMAIN = "@civiconnect.demo";
const DEMO_PASSWORD = "Demo@1234";
const DAY = 86_400_000;

// Small deterministic random generator so every run produces the same city.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(2027);
const between = (min: number, max: number) => min + rand() * (max - min);
const int = (min: number, max: number) => Math.floor(between(min, max + 1));
const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
const shuffle = <T,>(items: readonly T[]): T[] => [...items].sort(() => rand() - 0.5);

const OFFICERS = [
  { name: "Ravi Kumar", email: `ravi.kumar${DEMO_DOMAIN}`, department: "Roads and Pavements", handles: ["pothole", "other"] },
  { name: "Kiran Joshi", email: `kiran.joshi${DEMO_DOMAIN}`, department: "Roads and Pavements", handles: ["pothole"] },
  { name: "Sana Fatima", email: `sana.fatima${DEMO_DOMAIN}`, department: "Sanitation", handles: ["garbage"] },
  { name: "Farah Khan", email: `farah.khan${DEMO_DOMAIN}`, department: "Sanitation", handles: ["garbage", "other"] },
  { name: "Arjun Rao", email: `arjun.rao${DEMO_DOMAIN}`, department: "Street Lighting", handles: ["streetlight"] },
  { name: "Lakshmi Devi", email: `lakshmi.devi${DEMO_DOMAIN}`, department: "Drainage and Trees", handles: ["drainage", "fallen_tree"] },
] as const;

const CITIZENS = [
  "Anjali Sharma", "Karthik Reddy", "Priya Nair", "Mohammed Irfan", "Divya Patel", "Suresh Babu", "Neha Gupta", "Rahul Verma",
  "Sneha Kulkarni", "Vikram Singh", "Fatima Begum", "Arun Prakash", "Pooja Iyer", "Ganesh Naidu", "Ayesha Siddiqui", "Rohit Mehta",
  "Kavya Menon", "Imran Shaikh", "Lavanya Rao", "Deepak Chauhan",
];
const emailOf = (name: string) => `${name.toLowerCase().replace(/[^a-z]+/g, ".")}${DEMO_DOMAIN}`;

const AREAS = [
  { name: "Ameerpet", lat: 17.4375, lng: 78.4483, weight: 5, marks: ["Near Ameerpet metro station", "Opposite the Satyam theatre road", "Behind the HUDA market"] },
  { name: "Kukatpally", lat: 17.4948, lng: 78.3996, weight: 4, marks: ["Near KPHB Phase 3 bus stop", "Beside the Y-junction flyover", "Opposite the Forum Mall road"] },
  { name: "Madhapur", lat: 17.4486, lng: 78.3908, weight: 4, marks: ["Near Madhapur police station", "Under the Hitec City flyover", "Opposite the Inorbit entrance"] },
  { name: "Gachibowli", lat: 17.4401, lng: 78.3489, weight: 3, marks: ["Near the stadium gate", "Beside the DLF road crossing", "Opposite the IIIT lane"] },
  { name: "Secunderabad", lat: 17.4399, lng: 78.4983, weight: 3, marks: ["Near Paradise circle", "Beside the Clock Tower road", "Opposite the railway station exit"] },
  { name: "Uppal", lat: 17.4058, lng: 78.5591, weight: 3, marks: ["Near Uppal X roads", "Beside the stadium road", "Opposite the metro depot"] },
  { name: "Dilsukhnagar", lat: 17.3688, lng: 78.5247, weight: 3, marks: ["Near the bus depot", "Beside the Konark theatre lane", "Opposite the main market"] },
  { name: "Banjara Hills", lat: 17.4126, lng: 78.4482, weight: 2, marks: ["Near Road No. 12 signal", "Beside the City Centre mall", "Opposite the park gate"] },
  { name: "Jubilee Hills", lat: 17.4325, lng: 78.4073, weight: 2, marks: ["Near the Check Post junction", "Beside Road No. 36", "Opposite the film nagar entrance"] },
  { name: "Charminar", lat: 17.3616, lng: 78.4747, weight: 2, marks: ["Near the Laad Bazaar entrance", "Beside the Mecca Masjid road", "Opposite the Patthargatti crossing"] },
  { name: "LB Nagar", lat: 17.3457, lng: 78.5522, weight: 2, marks: ["Near the ring road", "Beside the Sagar Ring Road signal", "Opposite the metro station"] },
  { name: "Begumpet", lat: 17.4435, lng: 78.4676, weight: 2, marks: ["Near Begumpet flyover", "Beside the airport road", "Opposite Prakash Nagar station"] },
] as const;

const TEXTS: Record<Category, string[]> = {
  pothole: [
    "A deep pothole has opened in the middle of the lane. Two-wheelers swerve to avoid it and it fills with water after rain.",
    "Large crater in the road surface, about a foot wide. I saw a scooter skid here this morning.",
    "The tar has come off and the pothole keeps growing. Vehicles brake suddenly here, which is dangerous at night.",
  ],
  garbage: [
    "Garbage has not been cleared for several days. The smell is spreading and stray dogs are scattering it on the road.",
    "People dump waste on this corner and the pile now blocks half the footpath. Please arrange regular pickup.",
    "Overflowing bins and loose plastic bags near the lane entrance. Flies and mosquitoes are a real problem for residents.",
  ],
  drainage: [
    "The drain is blocked and dirty water is flowing over the road. Pedestrians have to walk through it.",
    "Sewage is overflowing from the manhole and has been like this since yesterday. The smell is unbearable.",
    "Water logging at this spot after every shower because the drain grate is choked with silt and plastic.",
  ],
  streetlight: [
    "The street light has not worked for a week and the whole stretch is dark after 7 pm. Women and children feel unsafe.",
    "Light keeps flickering and switches off at night. Please repair or replace the lamp.",
    "Two lamps in a row are dead, leaving a long dark patch next to the school lane.",
  ],
  fallen_tree: [
    "A large branch fell during last night's storm and is blocking the lane. Vehicles cannot pass properly.",
    "The whole tree has come down across the road and is touching the electric wire. Needs urgent attention.",
    "Heavy tree limb hanging dangerously over the footpath after the rain. It can fall any time.",
  ],
  other: [
    "The direction signboard is bent and unreadable, so drivers miss the turn.",
    "Broken footpath slabs are a trip hazard, especially for elderly people.",
    "The road divider has been damaged by a vehicle and sharp metal is sticking out.",
  ],
};

// Names and icons for the "other" texts above (same order), as a citizen would type them.
const OTHER_KINDS = [
  { label: "Bent signboard", icon: "signpost" },
  { label: "Broken footpath", icon: "footprints" },
  { label: "Damaged road divider", icon: "triangle-alert" },
];

// Preset avatars (emoji on a colour) so the demo people look like real users.
const AVATARS = [
  { emoji: "🌻", color: "#c2561f" }, { emoji: "🏏", color: "#2a7f9e" }, { emoji: "📚", color: "#6b4a8f" },
  { emoji: "☕", color: "#8a6100" }, { emoji: "🦉", color: "#4f7d3a" }, { emoji: "🛺", color: "#1f4e79" },
  { emoji: "🎧", color: "#b83a2e" }, { emoji: "🚲", color: "#2e7d5b" }, { emoji: "🔧", color: "#5b6b7a" },
  { emoji: "🌙", color: "#1f4e79" }, { emoji: "🧹", color: "#4f7d3a" }, { emoji: "💡", color: "#c99700" },
  { emoji: "🌳", color: "#2e7d5b" },
];

const NEIGHBOUR_LINES = [
  "Same here, I pass this spot every morning and it is getting worse.",
  "Adding to this: it is worse after rain, water collects and you cannot see it.",
  "My father nearly slipped here yesterday. Please treat this as urgent.",
  "Still there as of this evening. Took another look on my way back.",
  "Shopkeepers nearby say this has been reported before too.",
  "Thanks for reporting. I supported it, hope it gets fixed soon.",
  "School children walk this way, so it is risky in the mornings.",
  "Auto drivers are avoiding the lane completely because of this.",
];

const OFFICIAL_LINES = [
  "Site inspected today. Material is arranged and the crew is scheduled for tomorrow morning.",
  "We have raised a work order. Please avoid the left side of the lane until the work is complete.",
  "Thank you all for the details. The team is on site now.",
  "Work is planned for this week. We will post a photo once it is done.",
];

// Separate random stream for the discussions, so the city itself stays identical between versions.
const talkRand = rng(77);
const int2 = (min: number, max: number) => Math.floor(min + talkRand() * (max - min + 1));

const RESOLUTION: Record<Category, string[]> = {
  pothole: ["Pothole filled with hot mix and compacted. Road surface levelled.", "Patch work completed and the surface has been sealed."],
  garbage: ["Waste cleared and the spot disinfected. Daily pickup scheduled for this lane.", "Garbage removed and a bin placed. The sanitation team will monitor this point."],
  drainage: ["Drain de-silted and flow restored. Cover repaired.", "Blockage cleared with a jetting machine. Water is flowing normally."],
  streetlight: ["Faulty lamp replaced and tested after dark.", "Wiring repaired and the whole stretch is lit again."],
  fallen_tree: ["Tree removed and the road cleared. Branches shifted to the depot.", "Branches cut and the road reopened to traffic."],
  other: ["Damage repaired and the spot restored.", "Replacement fitted and checked by the inspector."],
};

const REJECTION = [
  "This location falls under a private society, so the municipality cannot act. The resident association has been informed.",
  "Duplicate of an issue closed last week. No new damage found at inspection.",
];

type Image = { url: string; publicId: string };
const slug = (c: Category) => (c === "fallen_tree" ? "tree" : c);
const img = (name: string): Image => ({ url: `/demo/${name}.svg`, publicId: `demo/${name}` });
const beforeImg = (c: Category) => img(`${slug(c)}-before`);
const afterImg = (c: Category) => img(`${slug(c)}-after`);


const EXTRA_AVATAR_EMOJI = ["🦁", "🐯", "🦊", "🐼", "🐢", "🐘", "🦚", "🌵", "🎨", "⚽", "🎸", "🍵", "🪁"];
const AVATAR_COLORS = ["#1f4e79", "#2a7f9e", "#2e7d5b", "#4f7d3a", "#c99700", "#c2561f", "#b83a2e", "#6b4a8f", "#5b6b7a"];
const avatarFor = (i: number) =>
  i < 8 ? AVATARS[i] : { emoji: EXTRA_AVATAR_EMOJI[i % EXTRA_AVATAR_EMOJI.length], color: AVATAR_COLORS[i % AVATAR_COLORS.length] };

const FLAG_NOTES = ["Looks like the same pothole as the one reported last week.", "This photo is from another city.", "Personal attack on a neighbour.", ""];
const HOUR = 3_600_000;
// Reports arrive mostly in the morning and evening (IST), which the hour-by-day heatmap shows.
const BUSY_HOURS = [7, 8, 8, 9, 9, 9, 10, 10, 11, 12, 13, 14, 16, 17, 18, 18, 19, 19, 20, 20, 21, 22];
const IST = 5.5 * HOUR;

async function clearDemo() {
  const demoUsers = (await User.find({ email: { $regex: `${DEMO_DOMAIN.replace(".", "\\.")}$` } }).select("_id").lean()).map((u) => u._id);
  const demoIds = (await Issue.find({ ticket: /^CC-D\d/ }).select("_id").lean()).map((i) => i._id);
  const comments = await Comment.deleteMany({ issue: { $in: demoIds } });
  await Flag.deleteMany({ issue: { $in: demoIds } });
  await Notification.deleteMany({ user: { $in: demoUsers } });
  await AuditLog.deleteMany({ "meta.demo": true });
  if (comments.deletedCount) console.log(`Removed ${comments.deletedCount} demo comments.`);
  const issues = await Issue.deleteMany({ ticket: /^CC-D\d/ });
  const users = await User.deleteMany({ _id: { $in: demoUsers } });
  console.log(`Removed ${issues.deletedCount} demo issues and ${users.deletedCount} demo users.`);
}

type Note = { user: Types.ObjectId; type: string; title: string; body?: string; link?: string; issue?: Types.ObjectId; category?: string; read: boolean; createdAt: Date; updatedAt: Date };
type Audit = { actor?: Types.ObjectId; actorName: string; actorRole: string; action: string; targetType: string; targetId?: string; summary: string; meta: { demo: true }; createdAt: Date };

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  await Promise.all([Issue.init(), Comment.init(), Flag.init(), Notification.init(), AuditLog.init()]);
  await clearDemo();
  if (process.argv.includes("--clear")) {
    await mongoose.disconnect();
    return;
  }

  const hash = await hashPassword(DEMO_PASSWORD);
  const now = Date.now();

  const admin = await User.create({
    name: "Meera Reddy",
    email: `admin${DEMO_DOMAIN}`,
    passwordHash: hash,
    role: "admin",
    department: "Commissioner's Office",
    avatar: AVATARS[12],
    bio: "Commissioner's office. I watch the city's pulse and make sure nothing waits too long.",
  });
  const officers = await Promise.all(
    OFFICERS.map((o, i) =>
      User.create({ name: o.name, email: o.email, passwordHash: hash, role: "officer", department: o.department, avatar: avatarFor(8 + i) }),
    ),
  );
  const citizens = await Promise.all(
    CITIZENS.map((name, i) => {
      const home = AREAS[i % AREAS.length];
      return User.create({
        name,
        email: emailOf(name),
        passwordHash: hash,
        role: "citizen",
        avatar: avatarFor(i),
        homeArea: home.name,
        homeLocation: { lat: home.lat, lng: home.lng },
        radiusKm: 2,
      });
    }),
  );

  // Several officers can handle a category; spread the work between them.
  const officerFor = (c: Category, n: number) => {
    const able = officers.filter((_, i) => (OFFICERS[i].handles as readonly string[]).includes(c));
    return able[n % able.length];
  };

  const slots = AREAS.flatMap((a) => Array.from({ length: a.weight }, () => a));
  const TOTAL = 150;
  const notes: Note[] = [];
  const audits: Audit[] = [];
  const createdIssues: { id: Types.ObjectId; ticket: string; reporters: Types.ObjectId[] }[] = [];
  let resolvedCount = 0;
  let escalatedCount = 0;

  const note = (user: Types.ObjectId, at: number, n: Omit<Note, "user" | "read" | "createdAt" | "updatedAt">) => {
    if (now - at > 6 * DAY || at > now) return;
    notes.push({ ...n, user, read: now - at > 2 * DAY, createdAt: new Date(at), updatedAt: new Date(at) });
  };
  const log = (actor: { _id: Types.ObjectId; name: string; role: string } | null, at: number, action: string, id: Types.ObjectId, summary: string) => {
    audits.push({
      actor: actor?._id,
      actorName: actor?.name ?? "CiviConnect",
      actorRole: actor?.role ?? "system",
      action,
      targetType: "issue",
      targetId: id.toString(),
      summary,
      meta: { demo: true },
      createdAt: new Date(at),
    });
  };

  for (let n = 1; n <= TOTAL; n++) {
    const area = slots[(n * 7) % slots.length];
    const category = pick(CATEGORIES.filter((c) => c !== "other" || rand() < 0.35));
    const slaH = DEFAULT_SLA_HOURS[category];
    const point = { lat: area.lat + between(-0.0034, 0.0034), lng: area.lng + between(-0.0034, 0.0034) };
    const ticket = `CC-D${String(n).padStart(4, "0")}`;
    const otherKind = category === "other" ? OTHER_KINDS[n % OTHER_KINDS.length] : undefined;
    const label = `${otherKind?.label ?? category.replace("_", " ")} · ${ticket}`;

    // 1. What state is it in today?
    const roll = rand();
    let status: Status =
      roll < 0.52 ? "resolved" : roll < 0.56 ? "rejected" : roll < 0.7 ? "in_progress" : roll < 0.82 ? "acknowledged" : "reported";
    const reopened = status === "in_progress" && rand() < 0.25;
    const open = status !== "resolved" && status !== "rejected";

    // 2. How old is it? Closed issues spread over 90 days (more recent ones more likely);
    //    open ones are mostly fresh, with some left overdue so escalations have material.
    const overdue = open && !reopened && rand() < 0.22;
    let ageDays: number;
    if (!open || reopened) ageDays = 1.5 + 88.5 * Math.pow(rand(), 1.6);
    else if (overdue) ageDays = (slaH / 24) * between(1.15, 2.2) + between(0, 4);
    else ageDays = between(0.04, Math.min((slaH / 24) * 0.85, 3));
    if (status === "reported" && ageDays > 2.5) status = "acknowledged";

    let createdAt = now - ageDays * DAY;
    if (ageDays > 1.2) {
      // Snap to a realistic hour of the day (in India time).
      const localMidnight = Math.floor((createdAt + IST) / DAY) * DAY - IST;
      createdAt = localMidnight + pick(BUSY_HOURS) * HOUR + int(0, 59) * 60_000;
    }

    // 3. Reports, support and photos.
    const reportCount = Math.min(citizens.length, rand() < 0.45 ? 1 : int(2, 7));
    const reporters = shuffle(citizens).slice(0, reportCount);
    const text = TEXTS[category];
    const hasPhoto = status === "resolved" || reopened || rand() < 0.7;
    const ageMs = now - createdAt;
    const reports = reporters.map((user, i) => ({
      user: user._id,
      description: text[(n + i) % text.length],
      images: i === 0 && hasPhoto ? [beforeImg(category)] : [],
      createdAt: new Date(createdAt + (i === 0 ? 0 : Math.min(ageMs * 0.7, between(0.05, 1.5) * DAY))),
    }));
    const supporters = shuffle(citizens).slice(0, int(0, 9)).map((u) => u._id);
    const officer = officerFor(category, n);

    // 4. Timeline. Fix time is a share of the allowed time: most fixes are on time, some are late.
    const timeline: { status: Status; note?: string; images?: Image[]; by?: Types.ObjectId; byName: string; at: Date }[] = [
      { status: "reported", note: "Issue reported", by: reporters[0]._id, byName: reporters[0].name, at: new Date(createdAt) },
    ];
    const fixMs = Math.min(ageMs * 0.85, slaH * HOUR * (rand() < 0.74 ? between(0.25, 0.95) : between(1.05, 1.9)));
    const ackAt = createdAt + Math.min(ageMs * 0.4, fixMs * between(0.05, 0.25));
    const workAt = createdAt + Math.min(ageMs * 0.6, fixMs * between(0.3, 0.6));
    const verifications: { user: Types.ObjectId; fixed: boolean; at: Date }[] = [];
    let assignedTo: Types.ObjectId | undefined;
    let resolvedAt: Date | undefined;
    let slaDueAt = new Date(createdAt + slaH * HOUR);
    let lastEvent = createdAt;
    const reporterIds = reporters.map((r) => r._id);

    note(admin._id, createdAt, { type: "new_issue", title: `New issue: ${label}`, body: `${area.name}`, link: "/dashboard", category });

    if (status === "rejected") {
      const at = createdAt + Math.min(ageMs * 0.5, between(0.2, 1.5) * DAY);
      timeline.push({ status: "rejected", note: pick(REJECTION), by: admin._id, byName: admin.name, at: new Date(at) });
      log(admin, at, "issue.rejected", new Types.ObjectId(), `${label}: Reported → Rejected`);
      lastEvent = at;
    } else if (status !== "reported") {
      assignedTo = officer._id;
      timeline.push({ status: "acknowledged", note: `Assigned to ${officer.name} (${officer.department})`, by: admin._id, byName: admin.name, at: new Date(ackAt) });
      log(admin, ackAt, "issue.assigned", new Types.ObjectId(), `${label} assigned to ${officer.name}`);
      note(officer._id, ackAt, { type: "assigned", title: `New assignment: ${label}`, body: area.name, category });
      for (const r of reporterIds) note(r, ackAt, { type: "status", title: `${label} was picked up`, body: `${officer.name} (${officer.department}) is now responsible for it.`, category });
      lastEvent = ackAt;
      if (status !== "acknowledged") {
        timeline.push({ status: "in_progress", note: pick(["Crew has been sent to the site.", "Work order issued and materials arranged.", "Inspection done, repair scheduled."]), by: officer._id, byName: officer.name, at: new Date(workAt) });
        log(officer, workAt, "issue.in_progress", new Types.ObjectId(), `${label}: Acknowledged → In progress`);
        for (const r of reporterIds) note(r, workAt, { type: "status", title: `${label} is now in progress`, category });
        lastEvent = workAt;
      }
      if (status === "resolved" || reopened) {
        const when = createdAt + fixMs;
        timeline.push({ status: "resolved", note: pick(RESOLUTION[category]), images: [afterImg(category)], by: officer._id, byName: officer.name, at: new Date(when) });
        log(officer, when, "issue.resolved", new Types.ObjectId(), `${label}: In progress → Resolved`);
        for (const r of reporterIds) note(r, when, { type: "resolved", title: `Fixed: ${label}`, body: "Is it really fixed? Tap to confirm or say it is still there.", category });
        lastEvent = when;
        if (reopened) {
          const back = when + Math.min((now - when) * 0.5, between(0.2, 1.2) * DAY);
          verifications.push({ user: reporters[0]._id, fixed: false, at: new Date(back) });
          timeline.push({ status: "in_progress", note: "Reopened: citizens report the problem is still there", byName: "Citizen verification", at: new Date(back) });
          note(officer._id, back, { type: "reopened", title: `Reopened by citizens: ${label}`, body: "Citizens say the problem is still there.", category });
          note(admin._id, back, { type: "reopened", title: `Reopened by citizens: ${label}`, category });
          slaDueAt = new Date(back + (slaH / 2) * HOUR);
          lastEvent = back;
        } else {
          resolvedAt = new Date(when);
          resolvedCount++;
          for (const v of shuffle(citizens).slice(0, int(1, 5))) verifications.push({ user: v._id, fixed: true, at: new Date(Math.min(now - 60_000, when + between(0.1, 2) * DAY)) });
        }
      }
    }

    // 5. Still open and past its fix-by time: escalated by the sweep.
    let escalatedAt: Date | undefined;
    let slaWarnedAt: Date | undefined;
    const isOpen = status !== "resolved" && status !== "rejected";
    if (isOpen && slaDueAt.getTime() < now) {
      escalatedAt = new Date(slaDueAt.getTime() + 60_000);
      timeline.push({ status, note: `Escalated automatically: the ${slaH}-hour fix-by time has passed. Priority raised.`, byName: "CiviConnect", at: escalatedAt });
      log(null, escalatedAt.getTime(), "issue.escalated", new Types.ObjectId(), `${label} escalated after missing its fix-by time`);
      note(admin._id, escalatedAt.getTime(), { type: "escalated", title: `Overdue: ${label}`, body: "The fix-by time passed. Priority was raised.", category });
      if (assignedTo) note(assignedTo, escalatedAt.getTime(), { type: "escalated", title: `Overdue: ${label}`, body: "The fix-by time passed. Priority was raised.", category });
      escalatedCount++;
      lastEvent = Math.max(lastEvent, escalatedAt.getTime());
    } else if (isOpen && assignedTo && slaDueAt.getTime() - now < slaH * HOUR * 0.25) {
      slaWarnedAt = new Date(now - 30 * 60_000);
      note(assignedTo, slaWarnedAt.getTime(), { type: "sla_warning", title: `Less than ${Math.max(1, Math.round((slaDueAt.getTime() - now) / HOUR))} h left to fix ${label}`, category });
    }

    const doc = new Issue({
      ticket,
      category,
      customLabel: otherKind?.label,
      customLabelKey: otherKind ? normaliseLabel(otherKind.label) : undefined,
      customIcon: otherKind?.icon,
      address: `${pick(area.marks)}, ${area.name}`,
      location: { type: "Point", coordinates: [point.lng, point.lat] },
      status,
      reports,
      supporters,
      assignedTo,
      timeline,
      verifications,
      resolvedAt,
      slaDueAt,
      slaWarnedAt,
      escalatedAt,
      unassignedAlertAt: status === "reported" && ageDays > 0.5 ? new Date(now - HOUR) : undefined,
      createdAt: new Date(createdAt),
      updatedAt: new Date(Math.min(lastEvent, now - 60_000)),
    });
    // Point the audit entries made above at the real issue id.
    for (const a of audits) if (a.summary.includes(ticket) && a.targetId && !createdIssues.some((c) => c.id.toString() === a.targetId)) a.targetId = doc._id.toString();
    for (const nt of notes) if (nt.title.includes(ticket)) { nt.issue = doc._id; nt.link = nt.link ?? `/issues/${doc._id}`; }

    // 6. A small discussion under busier issues: neighbours add detail, the officer posts an update.
    const talk = talkRand() < 0.6 ? int2(1, 5) : 0;
    const followers = new Set([...reporters.map((r) => r._id.toString())]);
    let lastActivity = new Date(Math.min(lastEvent, now - 60_000));
    const thread: Record<string, unknown>[] = [];
    for (let k = 0; k < talk; k++) {
      const official = k === talk - 1 && assignedTo && talkRand() < 0.7;
      const author = official ? officer : citizens[(n + k * 3) % citizens.length];
      const at = new Date(Math.min(now - 30 * 60_000, createdAt + ((k + 1) * (now - createdAt)) / (talk + 1)));
      thread.push({
        _id: new Types.ObjectId(),
        issue: doc._id,
        user: author._id,
        parent: null,
        body: official ? OFFICIAL_LINES[(n + k) % OFFICIAL_LINES.length] : NEIGHBOUR_LINES[(n * 3 + k) % NEIGHBOUR_LINES.length],
        images: [],
        official: Boolean(official),
        flaggedBy: [],
        hidden: false,
        deleted: false,
        createdAt: at,
        updatedAt: at,
      });
      followers.add(author._id.toString());
      if (official) for (const r of reporterIds) note(r, at.getTime(), { type: "comment", title: `Official update on ${label}`, body: `${officer.name}: ${String(thread[thread.length - 1].body).slice(0, 120)}`, link: `/issues/${doc._id}#discussion`, issue: doc._id, category });
      if (at > lastActivity) lastActivity = at;
    }
    if (thread.length) await Comment.collection.insertMany(thread);
    doc.commentCount = talk;
    doc.followers = [...followers].map((id) => new Types.ObjectId(id));
    doc.lastActivityAt = lastActivity;
    await doc.save({ timestamps: false });
    createdIssues.push({ id: doc._id, ticket, reporters: reporterIds });
  }

  // 7. Some open moderation work for the admin: flagged issues and comments.
  const flagged = createdIssues.filter((_, i) => i % 23 === 5).slice(0, 6);
  const flagDocs: Record<string, unknown>[] = [];
  for (const [k, item] of flagged.entries()) {
    const by = shuffle(citizens).filter((c) => !item.reporters.some((r) => r.equals(c._id))).slice(0, 1 + (k % 3));
    for (const c of by) {
      flagDocs.push({ targetType: "issue", target: item.id, issue: item.id, user: c._id, reason: pick(["duplicate", "fake", "wrong_location"] as const), note: pick(FLAG_NOTES) || undefined, status: "open", createdAt: new Date(now - between(0.1, 3) * DAY), updatedAt: new Date() });
    }
    await Issue.updateOne({ _id: item.id }, { $set: { flagCount: by.length } });
  }
  const someComments = await Comment.find({ issue: { $in: createdIssues.map((c) => c.id) }, official: false }).limit(60).lean();
  for (const [k, c] of someComments.filter((_, i) => i % 15 === 3).slice(0, 4).entries()) {
    const by = shuffle(citizens).filter((u) => !u._id.equals(c.user)).slice(0, k === 0 ? 3 : 1);
    for (const u of by) {
      flagDocs.push({ targetType: "comment", target: c._id, issue: c.issue, user: u._id, reason: k === 0 ? "abusive" : pick(["spam", "abusive", "other"] as const), note: pick(FLAG_NOTES) || undefined, status: "open", createdAt: new Date(now - between(0.1, 2) * DAY), updatedAt: new Date() });
    }
    await Comment.updateOne({ _id: c._id }, { $set: { flaggedBy: by.map((u) => u._id), hidden: by.length >= 3 } });
  }
  if (flagDocs.length) await Flag.collection.insertMany(flagDocs);
  for (const f of flagDocs.slice(0, 5)) {
    notes.push({ user: admin._id, type: "flag", title: `Content reported to admins (${f.targetType})`, body: `Reason: ${String(f.reason).replace("_", " ")}. Review it in the moderation queue.`, link: "/admin?tab=moderation", read: false, createdAt: f.createdAt as Date, updatedAt: f.createdAt as Date });
  }

  // 8. Notifications (last 6 days) and the audit trail.
  const capped = new Map<string, Note[]>();
  for (const nt of notes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
    const list = capped.get(nt.user.toString()) ?? [];
    if (list.length < 30) list.push(nt);
    capped.set(nt.user.toString(), list);
  }
  const allNotes = [...capped.values()].flat();
  if (allNotes.length) await Notification.collection.insertMany(allNotes);
  if (audits.length) await AuditLog.collection.insertMany(audits);

  console.log(`\nDemo city created: ${TOTAL} issues (${resolvedCount} resolved, ${escalatedCount} escalated), ${officers.length} officers, ${citizens.length} citizens.`);
  console.log(`Also: ${flagDocs.length} flags, ${allNotes.length} notifications, ${audits.length} audit entries.\n`);
  console.log(`All demo accounts use the password: ${DEMO_PASSWORD}`);
  console.log(`  Admin    admin${DEMO_DOMAIN}`);
  console.log(`  Officer  ${OFFICERS[0].email}`);
  console.log(`  Citizen  ${emailOf(CITIZENS[0])}\n`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Demo seeding failed:", err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
