import {
  Accessibility, Armchair, Baby, Bike, Bird, Bug, Building2, Bus, Cable, Car, Cctv, CircleHelp, Construction,
  Dog, Droplet, Fence, Flame, Flower2, Footprints, Hospital, House, Landmark, Megaphone, Milestone, ParkingMeter,
  Plug, Rat, Recycle, School, Shrub, Signpost, Siren, SprayCan, Store, Toilet, TrafficCone, Trees, TriangleAlert,
  Volume2, Waves, Wind, Zap, type LucideIcon,
} from "lucide-react";

// Icons a reporter can give an "Other" problem. Same keys as server/src/utils/customIcons.ts.
export const CUSTOM_ICONS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "circle-help", label: "General", icon: CircleHelp },
  { key: "signpost", label: "Signboard", icon: Signpost },
  { key: "milestone", label: "Road sign", icon: Milestone },
  { key: "footprints", label: "Footpath", icon: Footprints },
  { key: "triangle-alert", label: "Hazard", icon: TriangleAlert },
  { key: "traffic-cone", label: "Road works", icon: TrafficCone },
  { key: "construction", label: "Construction", icon: Construction },
  { key: "fence", label: "Fence or railing", icon: Fence },
  { key: "car", label: "Vehicle", icon: Car },
  { key: "bus", label: "Bus stop", icon: Bus },
  { key: "bike", label: "Cycle lane", icon: Bike },
  { key: "parking-meter", label: "Parking", icon: ParkingMeter },
  { key: "building-2", label: "Building", icon: Building2 },
  { key: "house", label: "House", icon: House },
  { key: "store", label: "Shop or stall", icon: Store },
  { key: "school", label: "School", icon: School },
  { key: "hospital", label: "Hospital", icon: Hospital },
  { key: "landmark", label: "Public building", icon: Landmark },
  { key: "trees", label: "Park", icon: Trees },
  { key: "shrub", label: "Overgrowth", icon: Shrub },
  { key: "flower-2", label: "Garden", icon: Flower2 },
  { key: "dog", label: "Stray animals", icon: Dog },
  { key: "bird", label: "Birds", icon: Bird },
  { key: "bug", label: "Mosquitoes or pests", icon: Bug },
  { key: "rat", label: "Rats", icon: Rat },
  { key: "droplet", label: "Water leak", icon: Droplet },
  { key: "waves", label: "Flooding", icon: Waves },
  { key: "flame", label: "Fire or burning", icon: Flame },
  { key: "wind", label: "Smoke or air", icon: Wind },
  { key: "zap", label: "Electricity", icon: Zap },
  { key: "plug", label: "Power point", icon: Plug },
  { key: "cable", label: "Loose wires", icon: Cable },
  { key: "volume-2", label: "Noise", icon: Volume2 },
  { key: "megaphone", label: "Loudspeaker", icon: Megaphone },
  { key: "recycle", label: "Recycling", icon: Recycle },
  { key: "toilet", label: "Public toilet", icon: Toilet },
  { key: "armchair", label: "Bench or seating", icon: Armchair },
  { key: "spray-can", label: "Graffiti", icon: SprayCan },
  { key: "cctv", label: "CCTV", icon: Cctv },
  { key: "siren", label: "Emergency", icon: Siren },
  { key: "accessibility", label: "Accessibility", icon: Accessibility },
  { key: "baby", label: "Children's area", icon: Baby },
];

export const customIconFor = (key: string | null | undefined): LucideIcon | null =>
  key ? (CUSTOM_ICONS.find((i) => i.key === key)?.icon ?? null) : null;

// Quick picks shown above the free-text box; each comes with a sensible icon.
export const OTHER_SUGGESTIONS: { label: string; icon: string }[] = [
  { label: "Open manhole", icon: "triangle-alert" },
  { label: "Broken footpath", icon: "footprints" },
  { label: "Stray dogs", icon: "dog" },
  { label: "Water leakage", icon: "droplet" },
  { label: "Loose electric wires", icon: "cable" },
  { label: "Damaged signboard", icon: "signpost" },
  { label: "Mosquito breeding", icon: "bug" },
  { label: "Broken bench", icon: "armchair" },
];
