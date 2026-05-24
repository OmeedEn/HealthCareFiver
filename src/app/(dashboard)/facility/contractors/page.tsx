'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ContractorProfileCard } from '@/components/contractor/profile-card'
import { CONTRACTOR_TYPE_LABELS, US_STATES } from '@/lib/utils/constants'
import { Search, SlidersHorizontal, X } from 'lucide-react'

interface ContractorProfile {
  id: string
  first_name: string
  last_name: string
  contractor_type: string
  specialties: string[]
  headline: string | null
  bio: string | null
  years_of_experience: number
  hourly_rate_min: number | null
  hourly_rate_max: number | null
  city: string | null
  state: string | null
  is_available: boolean
  average_rating: number
  total_reviews: number
  total_jobs_completed: number
  profiles: { avatar_url: string | null }
}

export default function FindContractorsPage() {
  const [contractors, setContractors] = useState<ContractorProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [contractorType, setContractorType] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [availableOnly, setAvailableOnly] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchContractors()
  }, [contractorType, stateFilter, availableOnly])

  async function fetchContractors() {
    setLoading(true)
    let query = supabase
      .from('contractor_profiles')
      .select('*, profiles!inner(avatar_url)')
      .order('average_rating', { ascending: false })
      .limit(50)

    if (contractorType) {
      query = query.eq('contractor_type', contractorType)
    }
    if (stateFilter) {
      query = query.eq('state', stateFilter)
    }
    if (availableOnly) {
      query = query.eq('is_available', true)
    }
    if (searchQuery) {
      query = query.textSearch('search_vector', searchQuery)
    }

    const { data, error } = await query
    if (!error && data) {
      setContractors(data as unknown as ContractorProfile[])
    }
    setLoading(false)
  }

  function handleSearch() {
    fetchContractors()
  }

  function clearFilters() {
    setSearchQuery('')
    setContractorType('')
    setStateFilter('')
    setAvailableOnly(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Find Contractors</h1>
        <p className="text-muted-foreground">
          Search for qualified healthcare professionals
        </p>
      </div>

      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, specialty, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch}>Search</Button>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="rounded-lg border p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Profession</Label>
              <Select value={contractorType} onValueChange={(v) => setContractorType(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="All professions" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTRACTOR_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>State</Label>
              <Select value={stateFilter} onValueChange={(v) => setStateFilter(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="All states" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={availableOnly}
                  onChange={(e) => setAvailableOnly(e.target.checked)}
                  className="rounded"
                />
                Available only
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear filters
            </Button>
          </div>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-64 rounded-lg border bg-muted animate-pulse"
            />
          ))}
        </div>
      ) : contractors.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No contractors found matching your criteria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contractors.map((contractor) => (
            <ContractorProfileCard
              key={contractor.id}
              contractor={contractor}
              href={`/facility/contractors/${contractor.id}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
