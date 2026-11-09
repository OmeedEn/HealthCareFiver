"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-4 data-horizontal:flex-col",
        className,
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list relative inline-flex items-center text-ink-muted group-data-vertical/tabs:flex-col group-data-vertical/tabs:items-stretch",
  {
    variants: {
      variant: {
        // Soft segmented pill — brand-tinted active state inside a white
        // rounded container with a subtle border + shadow.
        default:
          "h-11 w-fit gap-1 rounded-xl border border-line bg-surface p-1 shadow-sm",
        // Underlined tabs with a brand indicator riding along the
        // bottom border. Good for in-page section navigation.
        line: "h-11 gap-1 rounded-none border-b border-line bg-transparent group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col group-data-vertical/tabs:border-b-0 group-data-vertical/tabs:border-r",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        // Base typography + spacing — comfortable padding, smooth transitions,
        // brand focus ring at >40% opacity so it's visible but not
        // overpowering on either variant.
        "relative inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-150",
        "px-4 py-2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",

        // ----- DEFAULT variant (segmented pill) -----
        // Inactive: muted text on transparent; hover lifts text + paints a
        // faint grey background to telegraph clickability.
        "group-data-[variant=default]/tabs-list:rounded-lg",
        "group-data-[variant=default]/tabs-list:text-ink-muted",
        "group-data-[variant=default]/tabs-list:hover:text-ink group-data-[variant=default]/tabs-list:hover:bg-paper-sunken",
        // Active: soft brand tint background, deeper green text,
        // semibold weight, and we suppress the hover-grey by repeating the
        // brand bg on hover.
        "group-data-[variant=default]/tabs-list:data-active:bg-brand-tint group-data-[variant=default]/tabs-list:data-active:text-brand-ink group-data-[variant=default]/tabs-list:data-active:font-semibold group-data-[variant=default]/tabs-list:data-active:hover:bg-brand-tint",
        // Vertical default: tabs become full-width left-aligned rows.
        "group-data-vertical/tabs:group-data-[variant=default]/tabs-list:w-full group-data-vertical/tabs:group-data-[variant=default]/tabs-list:justify-start",

        // ----- LINE variant (underline) -----
        // Slightly tighter vertical padding so the indicator hugs the row.
        "group-data-[variant=line]/tabs-list:py-3",
        "group-data-[variant=line]/tabs-list:text-ink-muted",
        "group-data-[variant=line]/tabs-list:hover:text-ink",
        "group-data-[variant=line]/tabs-list:data-active:text-ink group-data-[variant=line]/tabs-list:data-active:font-semibold",

        // ----- LINE variant indicator -----
        // 2px brand stripe sitting on top of the list's 1px border, so
        // active tab visually replaces the divider. Hidden on the default
        // variant — `after` only activates with `data-[variant=line]`.
        "after:absolute after:bg-brand after:opacity-0 after:transition-opacity",
        "group-data-horizontal/tabs:after:inset-x-3 group-data-horizontal/tabs:after:bottom-[-1px] group-data-horizontal/tabs:after:h-0.5",
        "group-data-vertical/tabs:after:inset-y-1 group-data-vertical/tabs:after:right-[-1px] group-data-vertical/tabs:after:w-0.5",
        "group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
