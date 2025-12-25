import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface AvatarCustomProps {
  name: string;
  imageUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-emerald-500",
    "bg-blue-500",
    "bg-purple-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-indigo-500",
    "bg-teal-500",
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

const AvatarCustom = forwardRef<HTMLDivElement, AvatarCustomProps>(
  ({ name, imageUrl, size = "md", className }, ref) => {
    const sizeClasses = {
      xs: "h-6 w-6 text-[10px]",
      sm: "h-8 w-8 text-xs",
      md: "h-10 w-10 text-sm",
      lg: "h-14 w-14 text-lg",
    };

    if (imageUrl) {
      return (
        <img
          src={imageUrl}
          alt={name}
          className={cn(
            "rounded-full object-cover",
            sizeClasses[size],
            className
          )}
        />
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-full flex items-center justify-center font-medium text-white",
          getAvatarColor(name),
          sizeClasses[size],
          className
        )}
      >
        {getInitials(name)}
      </div>
    );
  }
);

AvatarCustom.displayName = "AvatarCustom";

export { AvatarCustom };
