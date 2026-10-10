// Preset avatars: pick an emoji and a background colour.
export const AVATAR_EMOJIS = [
  "🌻", "🏏", "📚", "☕", "🦉", "🛺", "🎧", "🚲", "🔧", "🌙", "🧹", "💡", "🌳",
  "🦁", "🐯", "🦊", "🐼", "🐢", "🐘", "🦚", "🌵", "🎨", "⚽", "🎸", "🍵", "🪁",
];

export const AVATAR_COLORS = ["#1f4e79", "#2a7f9e", "#2e7d5b", "#4f7d3a", "#c99700", "#c2561f", "#b83a2e", "#6b4a8f", "#5b6b7a"];

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("") || "?";
