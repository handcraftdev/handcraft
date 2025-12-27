"use client";

/**
 * HANDCRAFT DESIGN SYSTEM - COMPONENT LIBRARY
 * ============================================
 * Reusable UI components following the design system standards.
 *
 * These components enforce consistency across the application.
 * Always prefer using these over inline Tailwind classes.
 */

import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, forwardRef } from "react";
import Link from "next/link";

// ============================================
// PAGE LAYOUT COMPONENTS
// ============================================

interface PageLayoutProps {
  children: ReactNode;
}

/**
 * PageLayout - Main page wrapper
 * Provides consistent page structure with sidebar support
 */
export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-black text-white">
      {children}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  children?: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "page";
}

/**
 * PageHeader - Sticky header with title and optional actions
 */
export function PageHeader({ title, children, maxWidth = "page" }: PageHeaderProps) {
  const widthClasses = {
    sm: "max-w-sm",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-5xl",
    page: "max-w-page",
  };

  return (
    <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/[0.06]">
      <div className={`${widthClasses[maxWidth]} mx-auto px-4 sm:px-6`}>
        <div className="flex items-center justify-between h-14">
          <h1 className="text-lg font-medium text-white">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}

interface PageContentProps {
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "page";
}

/**
 * PageContent - Main content area wrapper
 */
export function PageContent({ children, maxWidth = "page" }: PageContentProps) {
  const widthClasses = {
    sm: "max-w-sm",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-5xl",
    page: "max-w-page",
  };

  return (
    <main className={`${widthClasses[maxWidth]} mx-auto px-4 sm:px-6 py-4`}>
      {children}
    </main>
  );
}

// ============================================
// TAB COMPONENTS
// ============================================

interface Tab {
  id: string;
  label: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

/**
 * TabBar - Horizontal tab navigation
 */
export function TabBar({ tabs, activeTab, onChange, className = "" }: TabBarProps) {
  return (
    <div className={`flex items-center gap-1 pb-3 overflow-x-auto no-scrollbar ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap ${
            activeTab === tab.id
              ? "bg-white text-black"
              : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

interface TabBarLinkProps {
  tabs: { id: string; label: string; href: string }[];
  activeTab: string;
  className?: string;
}

/**
 * TabBarLink - Tab navigation using Next.js Links
 */
export function TabBarLink({ tabs, activeTab, className = "" }: TabBarLinkProps) {
  return (
    <div className={`flex items-center gap-1 pb-3 overflow-x-auto no-scrollbar ${className}`}>
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap ${
            activeTab === tab.id
              ? "bg-white text-black"
              : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

// ============================================
// BUTTON COMPONENTS
// ============================================

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 hover:border-purple-500/50 text-purple-400",
  secondary: "bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.12] text-white/60 hover:text-white/80",
  danger: "bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 hover:border-red-500/50 text-red-400",
  ghost: "hover:bg-white/[0.04] text-white/40 hover:text-white/60 border border-transparent",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-sm rounded-md gap-1",
  md: "px-3 py-2 text-base rounded-lg gap-1.5",
  lg: "px-4 py-2.5 text-base rounded-lg gap-2",
};

/**
 * Button - Primary interactive element
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", isLoading, leftIcon, rightIcon, children, className = "", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`inline-flex items-center justify-center font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Spinner size="sm" />
        ) : leftIcon}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);
Button.displayName = "Button";

// ============================================
// INPUT COMPONENTS
// ============================================

type InputSize = "sm" | "md" | "lg";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  inputSize?: InputSize;
  label?: string;
  error?: string;
  required?: boolean;
}

const inputSizes: Record<InputSize, string> = {
  sm: "px-2.5 py-1.5 text-sm",
  md: "px-3 py-2 text-base",
  lg: "px-4 py-2.5 text-base",
};

/**
 * Input - Text input field
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ inputSize = "md", label, error, required, className = "", ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-white/60">
            {label}
            {required && <span className="text-red-400 ml-0.5">*</span>}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full bg-white/[0.04] border rounded-lg text-white/90 placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.06] transition-all duration-200 ${inputSizes[inputSize]} ${error ? "border-red-500/50" : "border-white/[0.08]"} ${className}`}
          {...props}
        />
        {error && <p className="text-2xs text-red-400">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  required?: boolean;
}

/**
 * Textarea - Multi-line text input
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, required, className = "", ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-white/60">
            {label}
            {required && <span className="text-red-400 ml-0.5">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          className={`w-full px-3 py-2 bg-white/[0.04] border rounded-lg text-base text-white/90 placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.06] transition-all duration-200 resize-none ${error ? "border-red-500/50" : "border-white/[0.08]"} ${className}`}
          {...props}
        />
        {error && <p className="text-2xs text-red-400">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

// ============================================
// CARD COMPONENTS
// ============================================

type CardSize = "sm" | "md" | "lg";

interface CardProps {
  children: ReactNode;
  size?: CardSize;
  className?: string;
  onClick?: () => void;
}

const cardSizes: Record<CardSize, string> = {
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

/**
 * Card - Container with border and background
 */
export function Card({ children, size = "md", className = "", onClick }: CardProps) {
  const interactive = onClick ? "cursor-pointer hover:border-white/[0.12] transition-all" : "";
  return (
    <div
      className={`bg-white/[0.02] border border-white/[0.08] rounded-lg ${cardSizes[size]} ${interactive} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// ============================================
// EMPTY STATE
// ============================================

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * EmptyState - Placeholder for empty content areas
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center max-w-xs">
        <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border border-white/10">
          {icon}
        </div>
        <h3 className="text-lg font-medium text-white mb-1">{title}</h3>
        {description && <p className="text-base text-white/40 mb-4">{description}</p>}
        {action}
      </div>
    </div>
  );
}

// ============================================
// BADGE
// ============================================

type BadgeVariant = "purple" | "cyan" | "emerald" | "amber" | "red" | "default";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const badgeVariants: Record<BadgeVariant, string> = {
  purple: "bg-purple-500/20 text-purple-400",
  cyan: "bg-cyan-500/20 text-cyan-400",
  emerald: "bg-emerald-500/20 text-emerald-400",
  amber: "bg-amber-500/20 text-amber-400",
  red: "bg-red-500/20 text-red-400",
  default: "bg-white/[0.08] text-white/60",
};

/**
 * Badge - Small label/tag component
 */
export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${badgeVariants[variant]} ${className}`}>
      {children}
    </span>
  );
}

// ============================================
// SPINNER
// ============================================

type SpinnerSize = "sm" | "md" | "lg";

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

const spinnerSizes: Record<SpinnerSize, string> = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

/**
 * Spinner - Loading indicator
 */
export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return (
    <div className={`animate-spin rounded-full border-2 border-white/20 border-t-white ${spinnerSizes[size]} ${className}`} />
  );
}

// ============================================
// ICON CONTAINER
// ============================================

type IconContainerSize = "sm" | "md" | "lg";
type IconContainerVariant = "default" | "purple" | "cyan" | "emerald" | "amber" | "red";

interface IconContainerProps {
  children: ReactNode;
  size?: IconContainerSize;
  variant?: IconContainerVariant;
  className?: string;
}

const iconContainerSizes: Record<IconContainerSize, string> = {
  sm: "w-7 h-7 rounded-md",
  md: "w-9 h-9 rounded-lg",
  lg: "w-12 h-12 rounded-lg",
};

const iconContainerVariants: Record<IconContainerVariant, string> = {
  default: "bg-white/[0.06]",
  purple: "bg-purple-500/20",
  cyan: "bg-cyan-500/20",
  emerald: "bg-emerald-500/20",
  amber: "bg-amber-500/20",
  red: "bg-red-500/20",
};

/**
 * IconContainer - Wrapper for icons with background
 */
export function IconContainer({ children, size = "md", variant = "default", className = "" }: IconContainerProps) {
  return (
    <div className={`flex items-center justify-center flex-shrink-0 ${iconContainerSizes[size]} ${iconContainerVariants[variant]} ${className}`}>
      {children}
    </div>
  );
}

// ============================================
// SECTION
// ============================================

interface SectionProps {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * Section - Content section with optional header
 */
export function Section({ title, children, action, className = "" }: SectionProps) {
  return (
    <div className={className}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// ============================================
// STAT CARD
// ============================================

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

/**
 * StatCard - Display a single metric/statistic
 */
export function StatCard({ label, value, icon, trend, trendValue }: StatCardProps) {
  const trendColors = {
    up: "text-emerald-400",
    down: "text-red-400",
    neutral: "text-white/40",
  };

  return (
    <Card size="sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wider">{label}</p>
          <p className="text-xl font-semibold text-white mt-1">{value}</p>
          {trend && trendValue && (
            <p className={`text-xs mt-1 ${trendColors[trend]}`}>{trendValue}</p>
          )}
        </div>
        {icon && (
          <IconContainer size="sm" variant="default">
            {icon}
          </IconContainer>
        )}
      </div>
    </Card>
  );
}

// ============================================
// LIST ITEM
// ============================================

interface ListItemProps {
  thumbnail?: ReactNode;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
}

/**
 * ListItem - Row item with thumbnail and content
 */
export function ListItem({ thumbnail, title, subtitle, meta, onClick, href, className = "" }: ListItemProps) {
  const content = (
    <>
      {thumbnail && (
        <div className="w-12 h-12 bg-white/[0.04] rounded-lg overflow-hidden flex-shrink-0">
          {thumbnail}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-base font-medium text-white/90 truncate">{title}</p>
        {subtitle && <p className="text-sm text-white/40 truncate mt-0.5">{subtitle}</p>}
      </div>
      {meta}
    </>
  );

  const baseClasses = `flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-all duration-200 ${className}`;

  if (href) {
    return (
      <Link href={href} className={baseClasses}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button onClick={onClick} className={`${baseClasses} w-full text-left`}>
        {content}
      </button>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}

// ============================================
// DIVIDER
// ============================================

interface DividerProps {
  orientation?: "horizontal" | "vertical";
  className?: string;
}

/**
 * Divider - Visual separator
 */
export function Divider({ orientation = "horizontal", className = "" }: DividerProps) {
  if (orientation === "vertical") {
    return <div className={`w-px h-4 bg-white/[0.08] ${className}`} />;
  }
  return <div className={`w-full h-px bg-white/[0.06] ${className}`} />;
}

// ============================================
// SKELETON
// ============================================

interface SkeletonProps {
  className?: string;
}

/**
 * Skeleton - Loading placeholder
 */
export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`bg-white/[0.04] rounded animate-pulse ${className}`} />;
}

// ============================================
// EXPORTS
// ============================================

export {
  type ButtonVariant,
  type ButtonSize,
  type CardSize,
  type BadgeVariant,
  type SpinnerSize,
  type IconContainerSize,
  type IconContainerVariant,
  type InputSize,
};
