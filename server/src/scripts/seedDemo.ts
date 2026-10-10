import mongoose, { Types } from "mongoose";
import { env } from "../config/env";
import { Comment } from "../models/Comment";
import { Flag } from "../models/Flag";
import { CATEGORIES, Issue, type Category, type Status } from "../models/Issue";
import { User } from "../models/User";
import { normaliseLabel } from "../utils/customIcons";
import { hashPassword } from "../utils/password";

/**
 * Fills the database with a realistic, fully fake city so every page looks alive in a demo.
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
  { name: "Sana Fatima", email: `sana.fatima${DEMO_DOMAIN}`, department: "Sanitation", handles: ["garbage"] },
  { name: "Arjun Rao", email: `arjun.rao${DEMO_DOMAIN}`, department: "Street Lighting", handles: ["streetlight"] },
  { name: "Lakshmi Devi", email: `lakshmi.devi${DEMO_DOMAIN}`, department: "Drainage and Trees", handles: ["drainage", "fallen_tree"] },
] as const;

const CITIZENS = [
  "Anjali Sharma", "Karthik Reddy", "Priya Nair", "Mohammed Irfan",
  "Divya Patel", "Suresh Babu", "Neha Gupta", "Rahul Verma",
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

async function clearDemo() {
  const demoIds = (await Issue.find({ ticket: /^CC-D\d/ }).select("_id").lean()).map((i) => i._id);
  const comments = await Comment.deleteMany({ issue: { $in: demoIds } });
  await Flag.deleteMany({ issue: { $in: demoIds } });
  if (comments.deletedCount) console.log(`Removed ${comments.deletedCount} demo comments.`);
  const issues = await Issue.deleteMany({ ticket: /^CC-D\d/ });
  const users = await User.deleteMany({ email: { $regex: `${DEMO_DOMAIN.replace(".", "\\.")}$` } });
  console.log(`Removed ${issues.deletedCount} demo issues and ${users.deletedCount} demo users.`);
}

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  await Issue.init();
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
      User.create({ name: o.name, email: o.email, passwordHash: hash, role: "officer", department: o.department, avatar: AVATARS[8 + i] }),
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
        avatar: AVATARS[i],
        homeArea: home.name,
        homeLocation: { lat: home.lat, lng: home.lng },
        radiusKm: 2,
      });
    }),
  );

  const officerFor = (c: Category) => officers[OFFICERS.findIndex((o) => (o.handles as readonly string[]).includes(c))];

  const slots = AREAS.flatMap((a) => Array.from({ length: a.weight }, () => a));
  const TOTAL = 46;
  let resolvedCount = 0;

  for (let n = 1; n <= TOTAL; n++) {
    const area = slots[(n * 7) % slots.length];
    const category = pick(CATEGORIES.filter((c) => c !== "other" || rand() < 0.35));
    const point = { lat: area.lat + between(-0.0032, 0.0032), lng: area.lng + between(-0.0032, 0.0032) };

    // The first few issues are old and still open, so overdue and escalation views have material.
    const overdue = n <= 5;
    const ageDays = overdue ? between(14, 26) : between(0.3, 27);
    const createdAt = now - ageDays * DAY;

    const roll = rand();
    let status: Status;
    let reopened = false;
    if (overdue) status = pick(["acknowledged", "in_progress"] as const);
    else if (roll < 0.17) status = "reported";
    else if (roll < 0.31) status = "acknowledged";
    else if (roll < 0.5) status = "in_progress";
    else if (roll < 0.93) status = "resolved";
    else if (roll < 0.97) status = "rejected";
    else {
      status = "in_progress";
      reopened = true;
    }
    if (ageDays < 1.2 && (status === "resolved" || reopened)) {
      status = "reported";
      reopened = false;
    }

    // Busier problems attract several reports from different people (the geo-merge at work).
    const reportCount = Math.min(citizens.length, rand() < 0.45 ? 1 : int(2, 6));
    const reporters = shuffle(citizens).slice(0, reportCount);
    const text = TEXTS[category];
    const hasPhoto = status === "resolved" || reopened || rand() < 0.7;

    const reports = reporters.map((user, i) => ({
      user: user._id,
      description: text[(n + i) % text.length],
      images: i === 0 && hasPhoto ? [beforeImg(category)] : [],
      createdAt: new Date(createdAt + i * between(0.2, 2.5) * DAY * Math.min(1, ageDays / 8)),
    }));

    const supporters = shuffle(citizens).slice(0, int(0, 6)).map((u) => u._id);
    const officer = officerFor(category);

    const timeline: { status: Status; note?: string; images?: Image[]; by?: Types.ObjectId; byName: string; at: Date }[] = [
      { status: "reported", note: "Issue reported", by: reporters[0]._id, byName: reporters[0].name, at: new Date(createdAt) },
    ];

    let t = createdAt;
    const step = () => (t += between(0.15, 1.6) * DAY * Math.min(1, ageDays / 6 + 0.1));
    const verifications: { user: Types.ObjectId; fixed: boolean; at: Date }[] = [];
    let assignedTo: Types.ObjectId | undefined;
    let resolvedAt: Date | undefined;

    if (status === "rejected") {
      timeline.push({ status: "rejected", note: pick(REJECTION), by: admin._id, byName: admin.name, at: new Date(step()) });
    } else if (status !== "reported") {
      assignedTo = officer._id;
      timeline.push({
        status: "acknowledged",
        note: `Assigned to ${officer.name} (${officer.department})`,
        by: admin._id,
        byName: admin.name,
        at: new Date(step()),
      });
      if (status !== "acknowledged") {
        timeline.push({
          status: "in_progress",
          note: pick(["Crew has been sent to the site.", "Work order issued and materials arranged.", "Inspection done, repair scheduled."]),
          by: officer._id,
          byName: officer.name,
          at: new Date(step()),
        });
      }
      if (status === "resolved" || reopened) {
        const when = new Date(step());
        timeline.push({ status: "resolved", note: pick(RESOLUTION[category]), images: [afterImg(category)], by: officer._id, byName: officer.name, at: when });
        if (reopened) {
          verifications.push({ user: reporters[0]._id, fixed: false, at: new Date(step()) });
          timeline.push({ status: "in_progress", note: "Reopened: citizens report the problem is still there", byName: "Citizen verification", at: new Date(step()) });
        } else {
          resolvedAt = when;
          resolvedCount++;
          // Resolved issues only carry "fixed" votes, so the data matches the reopen rule in the app.
          for (const v of shuffle(citizens).slice(0, int(1, 4))) verifications.push({ user: v._id, fixed: true, at: new Date(step()) });
        }
      }
    }

    const otherKind = category === "other" ? OTHER_KINDS[n % OTHER_KINDS.length] : undefined;

    const doc = new Issue({
      ticket: `CC-D${String(n).padStart(4, "0")}`,
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
      createdAt: new Date(createdAt),
      updatedAt: new Date(Math.min(t, now - 60_000)),
    });
    // A small discussion under busier issues: neighbours add detail, the officer posts an update.
    const talk = talkRand() < 0.6 ? int2(1, 4) : 0;
    const followers = new Set([...reporters.map((r) => r._id.toString())]);
    let lastActivity = new Date(Math.min(t, now - 60_000));
    for (let k = 0; k < talk; k++) {
      const official = k === talk - 1 && assignedTo && talkRand() < 0.7;
      const author = official ? officer : citizens[(n + k * 3) % citizens.length];
      const at = new Date(Math.min(now - 30 * 60_000, createdAt + (k + 1) * (now - createdAt) / (talk + 1)));
      await new Comment({
        issue: doc._id,
        user: author._id,
        body: official ? OFFICIAL_LINES[(n + k) % OFFICIAL_LINES.length] : NEIGHBOUR_LINES[(n * 3 + k) % NEIGHBOUR_LINES.length],
        official: Boolean(official),
        createdAt: at,
        updatedAt: at,
      }).save({ timestamps: false });
      followers.add(author._id.toString());
      if (at > lastActivity) lastActivity = at;
    }
    doc.commentCount = talk;
    doc.followers = [...followers].map((id) => new Types.ObjectId(id));
    doc.lastActivityAt = lastActivity;
    await doc.save({ timestamps: false });
  }

  console.log(`\nDemo city created: ${TOTAL} issues (${resolvedCount} resolved), ${officers.length} officers, ${citizens.length} citizens.\n`);
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
