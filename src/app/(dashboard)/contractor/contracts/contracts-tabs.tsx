'use client'

import { type ReactNode } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface ContractsTabsProps {
  tabCounts: {
    all: number
    active: number
    completed: number
  }
  activeContent: ReactNode
  completedContent: ReactNode
  allContent: ReactNode
}

export function ContractsTabs({
  tabCounts,
  activeContent,
  completedContent,
  allContent,
}: ContractsTabsProps) {
  return (
    <Tabs defaultValue="active">
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
      <TabsContent value="active">{activeContent}</TabsContent>
      <TabsContent value="completed">{completedContent}</TabsContent>
      <TabsContent value="all">{allContent}</TabsContent>
    </Tabs>
  )
}
