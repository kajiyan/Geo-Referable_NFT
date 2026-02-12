'use client';

/* eslint-disable react-refresh/only-export-components */

import React, { useState } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/cn'
import { HomeIcon, PlusIcon, UserIcon } from '@/components/ui/Icons'
import { BarItem } from './BarItem'
import type { BarProps, BarTab } from './types'
import { ICON_SIZE } from './constants'

/**
 * Bar container variant styles using CVA
 *
 * Architecture:
 * - Fixed positioning at bottom of viewport
 * - Safe area support for iOS devices
 * - 2px top border (Stone/600)
 * - White background
 */
export const barContainerVariants = cva(
  'fixed bottom-0 left-0 right-0 z-50 ' +
    'bg-white border-t-2 border-stone-600 ' +
    'pb-[env(safe-area-inset-bottom,0px)]',
  {
    variants: {},
    defaultVariants: {},
  }
)

/**
 * Bar content container variant styles
 * Handles the actual navigation items layout with safe area padding
 */
export const barContentVariants = cva(
  'flex items-stretch ' +
    'pl-[env(safe-area-inset-left,0px)] ' +
    'pr-[env(safe-area-inset-right,0px)]',
  {
    variants: {},
    defaultVariants: {},
  }
)

/**
 * Bottom Navigation Bar Component
 *
 * Refactored 2025 version with CVA + Tailwind CSS following Button component pattern.
 *
 * Features:
 * - **CVA Pattern**: Class Variance Authority for type-safe variants
 * - **Tailwind CSS**: Utility-first styling for maintainability
 * - **Safe Area Support**: Automatically adjusts for iPhone home indicator and notch
 * - **Component Composition**: Modular BarItem sub-components
 * - **Performance**: React.memo optimization
 * - **Type Safety**: Full TypeScript support with strict types
 * - **Accessibility**: Proper ARIA labels and keyboard navigation
 *
 * Improvements from Previous Version:
 * - Replaced inline CSSProperties with Tailwind classes
 * - Replaced BAR_STYLES object with CVA variants
 * - More readable and maintainable code
 * - Better alignment with project patterns (Button component)
 *
 * @example
 * ```tsx
 * import { Bar, type BarTab } from './components/Bar';
 *
 * function App() {
 *   const [activeTab, setActiveTab] = useState<BarTab>('home');
 *
 *   return (
 *     <div>
 *       <Bar activeTab={activeTab} onTabChange={setActiveTab} />
 *     </div>
 *   );
 * }
 * ```
 */
export const Bar: React.FC<BarProps> = React.memo(
  ({ activeTab: controlledActiveTab, onTabChange, className, style, children }) => {
    const [internalActiveTab, setInternalActiveTab] = useState<BarTab>('home')

    // Use controlled or uncontrolled state
    const activeTab = controlledActiveTab ?? internalActiveTab

    const handleTabChange = (tab: BarTab) => {
      if (onTabChange) {
        onTabChange(tab)
      } else {
        setInternalActiveTab(tab)
      }
    }

    // Render custom children if provided, otherwise render default tabs
    const content = children ?? (
      <>
        <BarItem
          icon={<HomeIcon size={ICON_SIZE} />}
          isActive={activeTab === 'home'}
          onClick={() => handleTabChange('home')}
          label="Home"
          showLeftBorder={false}
          isFirst={true}
        />

        <BarItem
          icon={<PlusIcon size={ICON_SIZE} />}
          isActive={activeTab === 'add'}
          onClick={() => handleTabChange('add')}
          label="Add"
          showLeftBorder={true}
        />

        <BarItem
          icon={<UserIcon size={ICON_SIZE} />}
          isActive={activeTab === 'user'}
          onClick={() => handleTabChange('user')}
          label="User"
          showLeftBorder={true}
          isLast={true}
        />
      </>
    )

    return (
      <nav
        className={cn(barContainerVariants(), className)}
        style={style}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Content container with safe area support */}
        <div className={cn(barContentVariants())} role="group" aria-label="Navigation tabs">
          {content}
        </div>
      </nav>
    )
  }
)

Bar.displayName = 'Bar'
