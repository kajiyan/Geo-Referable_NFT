# Button Component

Polymorphic button component supporting both `button` and `a` (anchor) elements with CVA-based variant management.

## Features

- ✅ **Polymorphic**: Render as `button` or `a` element
- ✅ **CVA Variants**: Type-safe variant management
- ✅ **Icon Support**: Left, right, or icon-only modes
- ✅ **Loading State**: Animated spinner
- ✅ **Full Accessibility**: ARIA attributes, keyboard navigation
- ✅ **TypeScript**: Full type safety with polymorphic props
- ✅ **Mobile-First**: Responsive design support
- ✅ **Tailwind CSS v4**: Modern styling

## Installation

```typescript
import { Button } from '@/components/Button'
import { HomeIcon } from '@/components/Icons'
```

## Usage

### Basic Button

```tsx
<Button>Click me</Button>
```

### Button as Link

```tsx
<Button as="a" href="/home">
  Go Home
</Button>
```

### With Icons

```tsx
// Left icon
<Button leftIcon={<HomeIcon />}>Home</Button>

// Right icon
<Button rightIcon={<ArrowRightIcon />}>Next</Button>

// Both icons
<Button leftIcon={<HomeIcon />} rightIcon={<ArrowRightIcon />}>
  Navigate
</Button>

// Icon only (requires aria-label)
<Button iconOnly leftIcon={<CloseIcon />} aria-label="Close" />
```

### Variants

```tsx
<Button variant="default">Default</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>
```

### Sizes

```tsx
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>
<Button size="xl">Extra Large</Button>
```

### Border Radius

```tsx
<Button rounded="none">No Radius</Button>
<Button rounded="sm">Small</Button>
<Button rounded="md">Medium</Button>
<Button rounded="lg">Large</Button>
<Button rounded="full">Full</Button>
```

### States

```tsx
// Loading
<Button isLoading>Saving...</Button>

// Disabled
<Button disabled>Disabled</Button>

// Full width
<Button fullWidth>Full Width</Button>
```

## API Reference

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `as` | `'button' \| 'a'` | `'button'` | HTML element to render |
| `variant` | `'default' \| 'outline' \| 'ghost' \| 'link'` | `'default'` | Visual style variant |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | Button size |
| `rounded` | `'none' \| 'sm' \| 'md' \| 'lg' \| 'full'` | `'md'` | Border radius |
| `leftIcon` | `React.ReactNode` | - | Icon on left side |
| `rightIcon` | `React.ReactNode` | - | Icon on right side |
| `iconOnly` | `boolean` | `false` | Hide children text, show icon only |
| `isLoading` | `boolean` | `false` | Show loading spinner |
| `fullWidth` | `boolean` | `false` | Full width mode |
| `disabled` | `boolean` | `false` | Disabled state |
| `className` | `string` | - | Additional Tailwind classes |

### Polymorphic Props

When `as="button"`:
- Accepts all `React.ButtonHTMLAttributes<HTMLButtonElement>`
- `type` defaults to `"button"`

When `as="a"`:
- Accepts all `React.AnchorHTMLAttributes<HTMLAnchorElement>`
- `href`, `target`, `rel`, etc. are fully typed

## Accessibility

### Icon-Only Buttons

Icon-only buttons **must** include `aria-label`:

```tsx
✅ Good
<Button iconOnly leftIcon={<CloseIcon />} aria-label="Close dialog" />

❌ Bad (will show console warning)
<Button iconOnly leftIcon={<CloseIcon />} />
```

### Loading State

Loading buttons automatically receive `aria-busy="true"`.

### Keyboard Navigation

- **Enter/Space**: Activate button
- **Tab**: Focus navigation
- Focus ring visible via `:focus-visible`

## Design Tokens

Based on Figma design system:

- **Colors**: Stone/600 (#57534e), White (#ffffff)
- **Typography**: Inter Semi Bold, 15px, weight 600, line-height 100%
- **Sizes**: sm (36px), md (40px), lg (48px), xl (64px - Figma design)

## Examples

### Call-to-Action Button

```tsx
<Button size="xl" leftIcon={<PlusIcon />}>
  新規作成
</Button>
```

### Navigation Link

```tsx
<Button as="a" href="/" variant="ghost" leftIcon={<HomeIcon />}>
  ホームへ戻る
</Button>
```

### Form Submit Button

```tsx
<Button type="submit" fullWidth isLoading={isSubmitting}>
  {isSubmitting ? '送信中...' : '送信'}
</Button>
```

### Responsive Button

```tsx
<Button className="h-10 sm:h-12 md:h-14 text-sm sm:text-base md:text-lg">
  レスポンシブ
</Button>
```

## Related Components

- **Icon Components**: [src/components/icons](../icons/)
- **Bar Component**: [src/components/Bar](../Bar/) (uses Button)
- **Header Component**: [src/components/Header](../Header/) (uses Button)

## Storybook

View all variants and examples in Storybook:

```bash
npm run storybook
```

Navigate to **Components → Button**

## Credits

- Design: [Figma NOROSI Design System](https://figma.com/design/xW6xYndw6GFaIgNPyPGOcK)
- Implementation: Generated from Figma Dev Mode
- Framework: React 19 + TypeScript 5.8
- Styling: Tailwind CSS v4 + CVA
