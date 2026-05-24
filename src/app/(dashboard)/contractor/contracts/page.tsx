import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  ContractCard,
  type ContractCardData,
} from '@/components/contracts/contract-card'
import { ContractsTabs } from './contracts-tabs'

interface ContractRow {
  id: string
  title: string
  status: string
  rate_amount: number | null
  rate_type: string | null
  start_date: string | null
  end_date: string | null
  created_at: string
  facility_profiles: {
    facility_name: string
  } | null
}

export default async function ContractorContractsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: contracts } = await supabase
    .from('contracts')
    .select(
      'id, title, status, rate_amount, rate_type, start_date, end_date, created_at, facility_profiles!inner(facility_name)'
    )
    .eq('contractor_id', user.id)
    .order('created_at', { ascending: false })

  const allContracts = (contracts ?? []) as unknown as ContractRow[]

  const tabCounts = {
    all: allContracts.length,
    active: allContracts.filter(
      (c) => c.status === 'active' || c.status === 'pending_contractor' || c.status === 'pending_facility'
    ).length,
    completed: allContracts.filter((c) => c.status === 'completed').length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Contracts</h1>
        <p className="text-muted-foreground">
          View and manage your contracts with facilities
        </p>
      </div>

      <ContractsTabs tabCounts={tabCounts}>
        {(tab: string) => {
          let filtered: ContractRow[]
          if (tab === 'active') {
            filtered = allContracts.filter(
              (c) =>
                c.status === 'active' ||
                c.status === 'pending_contractor' ||
                c.status === 'pending_facility'
            )
          } else if (tab === 'completed') {
            filtered = allContracts.filter((c) => c.status === 'completed')
          } else {
            filtered = allContracts
          }

          if (filtered.length === 0) {
            return (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">No contracts found.</p>
              </div>
            )
          }

          return (
            <div className="space-y-3">
              {filtered.map((contract) => {
                const cardData: ContractCardData = {
                  id: contract.id,
                  title: contract.title,
                  status: contract.status,
                  rate_amount: contract.rate_amount,
                  rate_type: contract.rate_type,
                  start_date: contract.start_date,
                  end_date: contract.end_date,
                  created_at: contract.created_at,
                }
                return (
                  <ContractCard
                    key={contract.id}
                    contract={cardData}
                    counterpartyName={
                      contract.facility_profiles?.facility_name ?? 'Unknown'
                    }
                    userRole="contractor"
                  />
                )
              })}
            </div>
          )
        }}
      </ContractsTabs>
    </div>
  )
}
