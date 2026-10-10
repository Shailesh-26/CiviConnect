import { initialsOf } from "../lib/avatar";
import type { Avatar as AvatarData } from "../types";

const SIZES = { xs: "size-7 text-xs", sm: "size-9 text-sm", md: "size-10 text-base", lg: "size-16 text-2xl", xl: "size-28 text-5xl" };

// A photo, an emoji on a colour, or the person's initials, in that order of preference.
export function Avatar({
  name,
  avatar,
  size = "md",
  className = "",
}: {
  name: string;
  avatar: AvatarData | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const box = `grid shrink-0 place-items-center overflow-hidden rounded-full ${SIZES[size]} ${className}`;
  if (avatar?.url) {
    return <img src={avatar.url} alt="" className={`${box} object-cover`} />;
  }
  if (avatar?.emoji) {
    return (
      <span className={box} style={{ background: avatar.color ?? "#1f4e79" }} aria-hidden>
        <span className="leading-none">{avatar.emoji}</span>
      </span>
    );
  }
  return (
    <span className={`${box} bg-signboard font-display font-bold text-white`} aria-hidden>
      {initialsOf(name)}
    </span>
  );
}
