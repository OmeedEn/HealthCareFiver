'use client'

import { type ReactNode } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

type TabKey = 'all' | 'open' | 'in_progress' | 'completed' | 'draft'

interface FacilityJobsTabsProps {
  tabCounts: Record<TabKey, number>
  // Pre-rendered server content per tab, passed as ReactNode props (not as a
  // render function) so this component works with a server-rendered parent.
  content: Record<TabKey, ReactNode>
}

const TABS: { value: TabKey; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'draft', label: 'Draft' },
]

export function FacilityJobsTabs({ tabCounts, content }: FacilityJobsTabsProps) {
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
          {content[tab.value]}
        </TabsContent>
      ))}
    </Tabs>
  )
}
