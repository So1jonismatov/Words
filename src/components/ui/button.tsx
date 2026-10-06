import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Material 3–style buttons: filled, tonal, text and plain icon-ish; all pill-shaped. */
const variants = {
  primary: "bg-accent text-accent-fg hover:shadow-md hover:brightness-[1.06] active:brightness-95 disabled:opacity-38 disabled:shadow-none",
  secondary: "bg-accent-soft text-fg hover:brightness-[1.08] dark:hover:brightness-125 disabled:opacity-50",
  ghost: "text-accent hover:bg-accent/10 disabled:opacity-50",
  plain: "text-muted hover:bg-fg/8 hover:text-fg disabled:opacity-50",
  danger: "bg-danger text-bg hover:brightness-110 disabled:opacity-50",
} as const;

const sizes = {
  sm: "h-8 px-3.5 text-[13px]",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-[15px]",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export const buttonClass = (variant: keyof typeof variants = "primary", size: keyof typeof sizes = "md") =>
  cn(
    "tap inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-full font-semibold tracking-[0.01em] transition-[filter,background-color,color,box-shadow] duration-150 disabled:cursor-not-allowed",
    variants[variant],
    sizes[size],
  );

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={cn(buttonClass(variant, size), className)} {...props} />;
});
