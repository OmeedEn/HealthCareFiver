'use client'

import { useState, type ReactNode } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface FacilityContractsTabsProps {
  tabCounts: {
    all: number
    active: number
    completed: number
  }
  // Pre-rendered server lists — passed as ReactNode (not a render function)
  // so this component is compatible with the server-rendered parent page.
  active: ReactNode
  completed: ReactNode
  all: ReactNode
}

export function FacilityContractsTabs({
  tabCounts,
  active,
  completed,
  all,
}: FacilityContractsTabsProps) {
  const [tab, setTab] = useState<'active' | 'completed' | 'all'>('active')

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as 'active' | 'completed' | 'all')}>
      <TabsList>
        <TabsTrigger value="active">Active ({tabCounts.active})</TabsTrigger>
        <TabsTrigger value="completed">
          Completed ({tabCounts.completed})
        </TabsTrigger>
        <TabsTrigger value="all">All ({tabCounts.all})</TabsTrigger>
      </TabsList>
      <TabsContent value="active">{active}</TabsContent>
      <TabsContent value="completed">{completed}</TabsContent>
      <TabsContent value="all">{all}</TabsContent>
    </Tabs>
  )
}
