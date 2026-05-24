'use client'

import { useState, type ReactNode } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface ContractsTabsProps {
  tabCounts: {
    all: number
    active: number
    completed: number
  }
  children: (tab: string) => ReactNode
}

export function ContractsTabs({ tabCounts, children }: ContractsTabsProps) {
  const [tab, setTab] = useState('active')

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as string)}>
      <TabsList>
        <TabsTrigger value="active">
          Active ({tabCounts.active})
        </TabsTrigger>
        <TabsTrigger value="completed">
          Completed ({tabCounts.completed})
        </TabsTrigger>
        <TabsTrigger value="all">
          All ({tabCounts.all})
        </TabsTrigger>
      </TabsList>
      <TabsContent value={tab}>{children(tab)}</TabsContent>
    </Tabs>
  )
}
