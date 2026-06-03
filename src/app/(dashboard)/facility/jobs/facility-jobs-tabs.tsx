'use client'

import { type ReactNode } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface FacilityJobsTabsProps {
  tabCounts: {
    all: number
    open: number
    in_progress: number
    completed: number
    draft: number
  }
  children: (status: string) => ReactNode
}

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'draft', label: 'Draft' },
] as const

export function FacilityJobsTabs({
  tabCounts,
  children,
}: FacilityJobsTabsProps) {
  return (
    <Tabs defaultValue="all">
      <TabsList>
        {TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label} ({tabCounts[tab.value]})
          </TabsTrigger>
        ))}
      </TabsList>
      {TABS.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {children(tab.value)}
        </TabsContent>
      ))}
    </Tabs>
  )
}
