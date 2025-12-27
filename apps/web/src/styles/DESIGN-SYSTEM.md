# Handcraft Design System

A comprehensive design system for consistent UI across all pages and components.

## Quick Reference

### Typography Scale

| Class | Size | Use Case |
|-------|------|----------|
| `text-2xs` | 9px | Micro labels, badge text |
| `text-xs` | 10px | Labels, captions, uppercase headers |
| `text-sm` | 11px | Secondary text, descriptions, tabs |
| `text-base` | 13px | Body text, inputs, buttons |
| `text-lg` | 15px | Page titles, section headers |
| `text-xl` | 18px | Large numbers, feature headers |
| `text-2xl` | 24px | Hero text (use sparingly) |

### Border Radius

| Class | Size | Use Case |
|-------|------|----------|
| `rounded-sm` | 4px | Small elements, badges |
| `rounded-md` | 6px | Buttons, inputs, tabs |
| `rounded-lg` | 8px | Cards, modals, containers |
| `rounded-xl` | 12px | Large cards (rarely used) |
| `rounded-full` | 9999px | Avatars, pills |

### Icon Sizes

| Size | Dimensions | Use Case |
|------|------------|----------|
| `w-3 h-3` | 12px | Inline with small text |
| `w-3.5 h-3.5` | 14px | Inline with body text |
| `w-4 h-4` | 16px | Buttons, inputs |
| `w-5 h-5` | 20px | Section icons, nav |
| `w-6 h-6` | 24px | Feature icons |
| `w-8 h-8` | 32px | Empty states, hero |

### Thumbnail & Avatar Sizes

| Size | Dimensions | Use Case |
|------|------------|----------|
| `w-8 h-8` | 32px | User avatars (compact), small icons |
| `w-10 h-10` | 40px | Feature icons, status badges |
| `w-12 h-12` | 48px | List item thumbnails, content cards |
| `w-16 h-16` | 64px | Modal previews, NFT thumbnails |
| `w-20 h-20` | 80px | Large previews, upload thumbnails |
| `w-24 h-24` | 96px | Hero content previews |

### Content Display Sizes

For content cards and bundles, use these consistent patterns:

| Context | Thumbnail | Aspect Ratio |
|---------|-----------|--------------|
| Feed card (compact) | `w-12 h-12` | Square |
| List item | `w-12 h-12` | Square |
| Modal preview | `w-16 h-16` | Square |
| Grid card | `aspect-square` or `aspect-video` | Responsive |
| Bundle item | `w-12 h-12` | Square |
| NFT preview | `w-16 h-16` | Square |

### Spacing

Use consistent spacing based on 4px increments:
- `gap-1` / `p-1` (4px) - Tight spacing
- `gap-2` / `p-2` (8px) - Compact elements
- `gap-3` / `p-3` (12px) - Standard cards
- `gap-4` / `p-4` (16px) - Comfortable spacing
- `gap-6` / `p-6` (24px) - Section spacing

### Opacity Scale for White

| Value | Use Case |
|-------|----------|
| `white/[0.04]` | Subtle backgrounds |
| `white/[0.06]` | Dividers, borders (subtle) |
| `white/[0.08]` | Default borders |
| `white/[0.12]` | Strong borders, hover states |
| `white/40` | Tertiary text, placeholders |
| `white/60` | Secondary text |
| `white/80` | Primary text |
| `white/90` | Headlines |

---

## Page Layout Pattern

Every page should follow this consistent structure:

```tsx
import { SidebarPanel } from "@/components/sidebar";

export default function MyPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white">
      <SidebarPanel isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Menu Button */}
      <button
        onClick={() => setIsSidebarOpen(prev => !prev)}
        className={`fixed top-4 z-50 p-3 bg-black/60 backdrop-blur-md rounded-full border border-white/10 hover:border-white/30 transition-all ${isSidebarOpen ? 'left-[264px]' : 'left-4'}`}
      >
        <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <h1 className="text-lg font-medium text-white">Page Title</h1>
            {/* Optional: Action buttons */}
          </div>

          {/* Optional: Tab Bar */}
          <div className="flex items-center gap-1 pb-3 overflow-x-auto no-scrollbar">
            {/* Tab buttons */}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
        {/* Page content */}
      </main>
    </div>
  );
}
```

---

## Component Patterns

### Tab Button

```tsx
// Active state
<button className="px-3 py-1.5 rounded-md text-sm font-medium bg-white text-black">
  Active Tab
</button>

// Inactive state
<button className="px-3 py-1.5 rounded-md text-sm font-medium text-white/40 hover:text-white/60 hover:bg-white/[0.04]">
  Inactive Tab
</button>
```

### Primary Button

```tsx
<button className="px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 hover:border-purple-500/50 rounded-lg text-base font-medium text-purple-400 transition-all">
  Button
</button>
```

### Secondary Button

```tsx
<button className="px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.12] rounded-lg text-base font-medium text-white/60 hover:text-white/80 transition-all">
  Button
</button>
```

### Input Field

```tsx
<div className="space-y-1.5">
  <label className="block text-sm font-medium text-white/60">Label</label>
  <input
    type="text"
    className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-base text-white/90 placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.06] transition-all"
    placeholder="Placeholder"
  />
</div>
```

### Card

```tsx
<div className="bg-white/[0.02] border border-white/[0.08] rounded-lg p-4">
  {/* Card content */}
</div>
```

### Empty State

```tsx
<div className="flex items-center justify-center py-16">
  <div className="text-center max-w-xs">
    <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border border-white/10">
      <svg className="w-6 h-6 text-white/50" ...>
    </div>
    <h3 className="text-lg font-medium text-white mb-1">Title</h3>
    <p className="text-base text-white/40">Description text</p>
  </div>
</div>
```

### Modal

```tsx
<div className="fixed inset-0 z-[100] flex items-center justify-center">
  {/* Backdrop */}
  <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

  {/* Modal Container */}
  <div className="relative w-full max-w-sm mx-4 p-4 bg-black border border-white/[0.08] rounded-lg shadow-2xl">
    {/* Header */}
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-medium text-white/90">Modal Title</h3>
      <button className="p-1.5 hover:bg-white/[0.06] rounded-lg text-white/40 hover:text-white/60">
        <svg className="w-4 h-4" ...>
      </button>
    </div>

    {/* Content */}
    <div className="space-y-4">
      {/* Modal content */}
    </div>

    {/* Footer */}
    <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-white/[0.06]">
      <button className="...">Cancel</button>
      <button className="...">Confirm</button>
    </div>
  </div>
</div>
```

### List Item

```tsx
<div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-all">
  {/* Thumbnail */}
  <div className="w-12 h-12 bg-white/[0.04] rounded-lg overflow-hidden flex-shrink-0">
    <img ... />
  </div>
  {/* Content */}
  <div className="flex-1 min-w-0">
    <p className="text-base font-medium text-white/90 truncate">Title</p>
    <p className="text-sm text-white/40 truncate mt-0.5">Subtitle</p>
  </div>
  {/* Optional: Actions */}
</div>
```

### Badge

```tsx
<span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400">
  Badge
</span>
```

### Section Header

```tsx
<h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
  Section Title
</h2>
```

### Stat Card

```tsx
<div className="bg-white/[0.02] border border-white/[0.08] rounded-lg p-3">
  <p className="text-xs text-white/40 uppercase tracking-wider">Label</p>
  <p className="text-xl font-semibold text-white mt-1">Value</p>
</div>
```

---

## Using the Component Library

Import from the design system components:

```tsx
import {
  PageLayout,
  PageHeader,
  PageContent,
  TabBar,
  Button,
  Input,
  Card,
  EmptyState,
  Badge,
  Spinner,
  IconContainer,
  Section,
  StatCard,
  ListItem,
  Divider,
  Skeleton,
} from "@/components/ui/design-system";
```

Example usage:

```tsx
export default function MyPage() {
  return (
    <PageLayout>
      <PageHeader title="My Page">
        <Button variant="primary" size="sm">Action</Button>
      </PageHeader>

      <PageContent>
        <Section title="Stats">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Total" value="123" />
          </div>
        </Section>

        <Section title="Items" className="mt-6">
          <Card>
            <ListItem
              title="Item Title"
              subtitle="Item description"
              thumbnail={<img src="..." />}
            />
          </Card>
        </Section>
      </PageContent>
    </PageLayout>
  );
}
```

---

## Migration Checklist

When updating existing components:

1. **Typography**
   - [ ] Replace `text-[9px]` with `text-2xs`
   - [ ] Replace `text-[10px]` with `text-xs`
   - [ ] Replace `text-[11px]` with `text-sm`
   - [ ] Replace `text-[12px]`, `text-[13px]` with `text-base`
   - [ ] Replace `text-[14px]`, `text-[15px]` with `text-lg`
   - [ ] Replace `text-[16px]`, `text-[18px]` with `text-xl`

2. **Border Radius**
   - [ ] Replace `rounded-xl` with `rounded-lg` for cards/modals
   - [ ] Replace `rounded-2xl` with `rounded-lg`
   - [ ] Use `rounded-md` for buttons/inputs
   - [ ] Use `rounded-sm` for badges

3. **Icons**
   - [ ] Standardize icon sizes per use case
   - [ ] Use consistent stroke width (1.5 for most)

4. **Spacing**
   - [ ] Use `p-3` or `p-4` for cards (not p-5, p-6)
   - [ ] Use `gap-3` or `gap-4` for grids
   - [ ] Use `py-4` for main content padding

5. **Colors**
   - [ ] Use semantic color tokens where available
   - [ ] Standardize opacity values

---

## Files

- `src/styles/design-system.css` - CSS variables and utility classes
- `tailwind.config.ts` - Extended Tailwind configuration
- `src/components/ui/design-system/index.tsx` - React component library
- `src/styles/DESIGN-SYSTEM.md` - This documentation
