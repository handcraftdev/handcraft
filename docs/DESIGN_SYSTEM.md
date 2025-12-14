# Handcraft Design System

## Design Philosophy

### The "Immersive Dark Canvas" Approach

Handcraft uses an **immersive, cinema-grade dark interface** that feels like a premium creative tool. The design draws inspiration from high-end video editing software, luxury brand websites, and modern fintech applications.

**Core Principles:**

1. **Pure Black Canvas** - The background is true black (`bg-black`), creating maximum contrast and allowing content to "float" in space
2. **Glassmorphic Layering** - UI elements use subtle transparency and blur effects to create depth without visual clutter
3. **Whisper-Level Typography** - Text uses carefully calibrated opacity levels rather than gray colors, maintaining the monochromatic elegance
4. **Deliberate Restraint** - Every element earns its place; no decorative noise, no gratuitous animations
5. **Color as Meaning** - Color is reserved for semantic purposes (status, categories, actions) rather than decoration

---

## Color System

### Base Palette

```css
/* Canvas */
--canvas-black: #000000;                    /* bg-black */

/* Surface Layers (white with opacity) */
--surface-0: rgba(255, 255, 255, 0.02);    /* bg-white/[0.02] - Subtle cards */
--surface-1: rgba(255, 255, 255, 0.05);    /* bg-white/5 - Input backgrounds */
--surface-2: rgba(255, 255, 255, 0.07);    /* bg-white/[0.07] - Focus states */
--surface-3: rgba(255, 255, 255, 0.10);    /* bg-white/10 - Hover states */

/* Borders */
--border-subtle: rgba(255, 255, 255, 0.05);  /* border-white/5 */
--border-default: rgba(255, 255, 255, 0.10); /* border-white/10 */
--border-emphasis: rgba(255, 255, 255, 0.20); /* border-white/20 */
```

### Typography Opacity Scale

```css
/* Text hierarchy using opacity, not gray */
--text-primary: rgba(255, 255, 255, 0.90);   /* text-white/90 - Headings, important text */
--text-secondary: rgba(255, 255, 255, 0.70); /* text-white/70 - Body text */
--text-tertiary: rgba(255, 255, 255, 0.40);  /* text-white/40 - Descriptions */
--text-muted: rgba(255, 255, 255, 0.30);     /* text-white/30 - Hints, labels */
--text-ghost: rgba(255, 255, 255, 0.20);     /* text-white/20 - Placeholders */
```

### Semantic Colors

Each color has a specific meaning and use case:

```css
/* Purple - Primary brand, content/NFT actions */
--purple-bg: rgba(168, 85, 247, 0.20);      /* bg-purple-500/20 */
--purple-border: rgba(168, 85, 247, 0.30);  /* border-purple-500/30 */
--purple-text: #c084fc;                      /* text-purple-400 */
--purple-glow: rgba(168, 85, 247, 0.50);    /* For shadows/glows */

/* Emerald - Success, rewards, positive states */
--emerald-bg: rgba(16, 185, 129, 0.10);     /* bg-emerald-500/10 */
--emerald-border: rgba(16, 185, 129, 0.20); /* border-emerald-500/20 */
--emerald-text: #34d399;                     /* text-emerald-400 */

/* Amber - Warnings, rentals, attention */
--amber-bg: rgba(245, 158, 11, 0.10);       /* bg-amber-500/10 */
--amber-border: rgba(245, 158, 11, 0.20);   /* border-amber-500/20 */
--amber-text: #fbbf24;                       /* text-amber-400 */

/* Cyan - Bundles, secondary actions */
--cyan-bg: rgba(6, 182, 212, 0.10);         /* bg-cyan-500/10 */
--cyan-border: rgba(6, 182, 212, 0.20);     /* border-cyan-500/20 */
--cyan-text: #22d3ee;                        /* text-cyan-400 */

/* Red - Destructive actions, errors */
--red-bg: rgba(239, 68, 68, 0.10);          /* bg-red-500/10 */
--red-border: rgba(239, 68, 68, 0.20);      /* border-red-500/20 */
--red-text: #f87171;                         /* text-red-400 */

/* Blue - Information, loading states */
--blue-bg: rgba(59, 130, 246, 0.10);        /* bg-blue-500/10 */
--blue-border: rgba(59, 130, 246, 0.20);    /* border-blue-500/20 */
--blue-text: #60a5fa;                        /* text-blue-400 */
```

### Color Usage by Context

| Context | Primary Color | Use Case |
|---------|--------------|----------|
| Content/NFT | Purple | Minting, content actions, primary CTAs |
| Bundles | Cyan | Bundle management, collection actions |
| Rewards | Emerald | Claiming, earnings, positive values |
| Rentals | Amber | Temporary access, time-based actions |
| Errors | Red | Destructive actions, error states |
| Profile | Purple | User-related actions |

---

## Typography

### Scale & Hierarchy

```css
/* Headings */
.heading-xl: text-4xl font-bold tracking-tight;     /* Page titles */
.heading-lg: text-2xl font-bold tracking-tight;     /* Section headers */
.heading-md: text-lg font-medium;                    /* Card titles */
.heading-sm: text-base font-medium;                  /* Subsection titles */

/* Labels (Whisper Style) */
.label-uppercase: text-[11px] uppercase tracking-[0.2em] text-white/30;
.label-small: text-[10px] uppercase tracking-[0.2em] text-white/30;

/* Body */
.body-default: text-sm text-white/70;
.body-muted: text-sm text-white/40;
.body-hint: text-xs text-white/30;
```

### Label Pattern

Section labels use the "whisper" style - extremely small, uppercase, with wide letter-spacing:

```jsx
<p className="text-[11px] uppercase tracking-[0.2em] text-white/30 mb-2">
  Label Text
</p>
```

---

## Component Patterns

### Cards & Containers

**Standard Card:**
```jsx
<div className="relative p-6 rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
  {/* Gradient overlay (optional) */}
  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />

  <div className="relative">
    {/* Content */}
  </div>
</div>
```

**Interactive Card (with hover):**
```jsx
<div className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/5
                hover:border-white/10 transition-all duration-300 cursor-pointer">
  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent
                  opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
  {/* Content */}
</div>
```

### Buttons

**Primary Button (Purple):**
```jsx
<button className="px-6 py-3 bg-purple-500/20 hover:bg-purple-500/30
                   border border-purple-500/30 hover:border-purple-500/50
                   rounded-xl font-medium text-white/90
                   transition-all duration-300 disabled:opacity-30">
  Button Text
</button>
```

**Secondary Button (Neutral):**
```jsx
<button className="px-6 py-3 bg-white/5 hover:bg-white/10
                   border border-white/10 hover:border-white/20
                   rounded-xl font-medium text-white/70 hover:text-white/90
                   transition-all duration-300">
  Button Text
</button>
```

**Destructive Button (Red):**
```jsx
<button className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20
                   border border-red-500/20 hover:border-red-500/30
                   rounded-xl font-medium text-red-400
                   transition-all duration-300">
  Delete
</button>
```

### Form Inputs

**Text Input:**
```jsx
<input
  type="text"
  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl
             focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07]
             text-white/90 placeholder:text-white/20
             transition-all duration-300"
  placeholder="Enter value..."
/>
```

**Radio Button Group:**
```jsx
<div className="flex gap-3">
  <button
    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 text-sm ${
      isSelected
        ? "bg-purple-500/20 border border-purple-500/50 text-purple-300"
        : "bg-white/[0.02] border border-white/10 text-white/50 hover:bg-white/5"
    }`}
  >
    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
      isSelected ? "border-purple-400" : "border-white/30"
    }`}>
      {isSelected && <div className="w-2 h-2 rounded-full bg-purple-400" />}
    </div>
    Option
  </button>
</div>
```

### Modals

**Modal Structure:**
```jsx
<div className="fixed inset-0 z-50 flex items-center justify-center">
  {/* Backdrop */}
  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

  {/* Modal Content */}
  <div className="relative bg-black border border-white/10 rounded-2xl
                  w-full max-w-md p-6 m-4 max-h-[90vh] overflow-y-auto">
    {/* Gradient overlay */}
    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent
                    pointer-events-none rounded-2xl" />

    <div className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-white/90">Modal Title</h2>
        <button className="p-2 hover:bg-white/5 rounded-full transition-all duration-300
                          text-white/40 hover:text-white/70">
          {/* Close icon */}
        </button>
      </div>

      {/* Content */}
    </div>
  </div>
</div>
```

### Status Badges

```jsx
{/* Active/Success */}
<span className="px-2.5 py-1 rounded-full text-[11px]
                 bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20">
  Active
</span>

{/* Warning */}
<span className="px-2.5 py-1 rounded-full text-[11px]
                 bg-amber-500/10 text-amber-400/80 border border-amber-500/20">
  Locked
</span>

{/* Neutral */}
<span className="px-2.5 py-1 rounded-full text-[11px]
                 bg-white/5 text-white/40 border border-white/10">
  Inactive
</span>
```

---

## Animation & Motion

### Transition Defaults

All interactive elements use consistent timing:

```css
transition-all duration-300  /* Standard transitions */
transition-all duration-200  /* Quick feedback (buttons, inputs) */
transition-all duration-500  /* Larger state changes */
transition-transform duration-1000  /* Shimmer effects */
```

### Hover Patterns

**Gradient Reveal:**
```jsx
<div className="group relative">
  <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent
                  opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
</div>
```

**Shimmer Effect (for CTAs):**
```jsx
<button className="group relative overflow-hidden">
  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-white/20 to-purple-500/0
                  translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
</button>
```

### Loading States

**Spinner:**
```jsx
<svg className="animate-spin w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24">
  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
  <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
</svg>
```

**Skeleton:**
```jsx
<div className="animate-pulse">
  <div className="h-6 bg-white/5 rounded-lg w-1/3 mb-4" />
  <div className="h-10 bg-white/5 rounded-xl" />
</div>
```

---

## Spacing & Layout

### Standard Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `p-4` | 16px | Card padding (compact) |
| `p-5` | 20px | Card padding (default) |
| `p-6` | 24px | Modal padding, large cards |
| `p-8` | 32px | Hero sections |
| `gap-2` | 8px | Tight element spacing |
| `gap-3` | 12px | Default element spacing |
| `gap-4` | 16px | Section spacing |
| `gap-6` | 24px | Major section spacing |
| `mb-2` | 8px | Label to input spacing |
| `mb-3` | 12px | Label to input group |
| `mb-6` | 24px | Section header to content |

### Border Radius Scale

| Token | Usage |
|-------|-------|
| `rounded-lg` | Small elements (badges, small buttons) |
| `rounded-xl` | Inputs, buttons, nav items |
| `rounded-2xl` | Cards, modals, major containers |
| `rounded-3xl` | Hero cards, feature banners |
| `rounded-full` | Avatars, circular elements |

---

## Glow Effects & Depth

### Subtle Glow (for emphasis):
```jsx
<div className="shadow-lg shadow-purple-500/20">
```

### Atmospheric Blur Orbs:
```jsx
{/* Large glow effect */}
<div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px]" />
```

### Gradient Borders:
```jsx
<div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-purple-500/50 via-white/10 to-transparent" />
```

---

## Icon Guidelines

- Use outline/stroke icons (not filled) with `strokeWidth={1.5}`
- Default size: `w-5 h-5` for navigation, `w-4 h-4` for inline
- Icon containers: `w-10 h-10` or `w-12 h-12` with rounded-xl and background

```jsx
<div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    {/* path */}
  </svg>
</div>
```

---

## Do's and Don'ts

### Do:
- Use opacity-based whites for text hierarchy
- Apply transitions to all interactive elements
- Use semantic colors consistently
- Add gradient overlays for depth
- Maintain generous spacing

### Don't:
- Use gray colors (use `white/opacity` instead)
- Use solid backgrounds (use transparency)
- Mix color semantics (purple for errors, red for success)
- Over-animate (keep it subtle and purposeful)
- Use sharp corners on major containers

---

## Quick Reference

### Most Common Classes

```css
/* Backgrounds */
bg-black                    /* Canvas */
bg-white/[0.02]            /* Cards */
bg-white/5                 /* Inputs, hover states */
bg-purple-500/20           /* Primary buttons */

/* Borders */
border-white/5             /* Subtle borders */
border-white/10            /* Default borders */
border-purple-500/30       /* Primary accent */

/* Text */
text-white/90              /* Primary text */
text-white/40              /* Secondary text */
text-white/30              /* Muted text */
text-purple-400            /* Accent text */

/* Rounded */
rounded-xl                 /* Most elements */
rounded-2xl                /* Cards, modals */

/* Transitions */
transition-all duration-300
```

---

*Last updated: December 2024*
