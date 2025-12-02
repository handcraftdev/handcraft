import { forwardRef, ImgHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

const avatarVariants = cva(
  "relative inline-flex shrink-0 overflow-hidden rounded-full bg-gray-800",
  {
    variants: {
      size: {
        xs: "h-6 w-6",
        sm: "h-8 w-8",
        md: "h-10 w-10",
        lg: "h-12 w-12",
        xl: "h-16 w-16",
        "2xl": "h-24 w-24",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

export interface AvatarProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "size">,
    VariantProps<typeof avatarVariants> {
  fallback?: string;
}

export const Avatar = forwardRef<HTMLImageElement, AvatarProps>(
  ({ className, size, src, alt, fallback, ...props }, ref) => {
    const initials = fallback
      ? fallback
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)
      : "?";

    if (!src) {
      return (
        <div
          className={cn(
            avatarVariants({ size, className }),
            "flex items-center justify-center text-gray-400 font-medium"
          )}
        >
          {initials}
        </div>
      );
    }

    return (
      <img
        ref={ref}
        src={src}
        alt={alt || "Avatar"}
        className={cn(avatarVariants({ size, className }), "object-cover")}
        {...props}
      />
    );
  }
);

Avatar.displayName = "Avatar";

export { avatarVariants };
