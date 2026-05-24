'use client'

import { useState } from 'react'
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  CONTRACTOR_TYPE_LABELS,
  JOB_TYPE_LABELS,
  SHIFT_TYPE_LABELS,
  US_STATES,
} from '@/lib/utils/constants'
import { SlidersHorizontalIcon, XIcon } from 'lucide-react'

export interface JobFilters {
  search: string
  contractor_type: string
  job_type: string
  shift_type: string
  state: string
  city: string
  pay_min: string
  pay_max: string
  start_date: string
  urgency: string
  sort: string
}

export const defaultFilters: JobFilters = {
  search: '',
  contractor_type: '',
  job_type: '',
  shift_type: '',
  state: '',
  city: '',
  pay_min: '',
  pay_max: '',
  start_date: '',
  urgency: '',
  sort: 'newest',
}

interface JobSearchFiltersProps {
  filters: JobFilters
  onFilterChange: (filters: JobFilters) => void
}

function FilterFields({
  filters,
  onChange,
}: {
  filters: JobFilters
  onChange: (key: keyof JobFilters, value: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="contractor_type">Contractor Type</Label>
        <Select
          value={filters.contractor_type}
          onValueChange={(v) => onChange('contractor_type', v ?? '')}
        >
          <SelectTrigger className="w-full" id="contractor_type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All types</SelectItem>
            {Object.entries(CONTRACTOR_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="job_type">Job Type</Label>
        <Select
          value={filters.job_type}
          onValueChange={(v) => onChange('job_type', v ?? '')}
        >
          <SelectTrigger className="w-full" id="job_type">
            <SelectValue placeholder="All job types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All job types</SelectItem>
            {Object.entries(JOB_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="shift_type">Shift Type</Label>
        <Select
          value={filters.shift_type}
          onValueChange={(v) => onChange('shift_type', v ?? '')}
        >
          <SelectTrigger className="w-full" id="shift_type">
            <SelectValue placeholder="All shifts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All shifts</SelectItem>
            {Object.entries(SHIFT_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="state">State</Label>
        <Select
          value={filters.state}
          onValueChange={(v) => onChange('state', v ?? '')}
        >
          <SelectTrigger className="w-full" id="state">
            <SelectValue placeholder="All states" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All states</SelectItem>
            {US_STATES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="city">City</Label>
        <Input
          id="city"
          placeholder="Enter city"
          value={filters.city}
          onChange={(e) => onChange('city', e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Pay Range</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={filters.pay_min}
            onChange={(e) => onChange('pay_min', e.target.value)}
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="number"
            placeholder="Max"
            value={filters.pay_max}
            onChange={(e) => onChange('pay_max', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="start_date">Start Date (from)</Label>
        <Input
          id="start_date"
          type="date"
          value={filters.start_date}
          onChange={(e) => onChange('start_date', e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="urgency">Urgency</Label>
        <Select
          value={filters.urgency}
          onValueChange={(v) => onChange('urgency', v ?? '')}
        >
          <SelectTrigger className="w-full" id="urgency">
            <SelectValue placeholder="Any urgency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Any urgency</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export function JobSearchFilters({
  filters,
  onFilterChange,
}: JobSearchFiltersProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleChange = (key: keyof JobFilters, value: string) => {
    onFilterChange({ ...filters, [key]: value })
  }

  const hasActiveFilters = Object.entries(filters).some(
    ([key, value]) =>
      key !== 'search' && key !== 'sort' && value !== '' && value !== defaultFilters[key as keyof JobFilters]
  )

  const clearFilters = () => {
    onFilterChange({ ...defaultFilters, search: filters.search, sort: filters.sort })
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Filters</h3>
            {hasActiveFilters && (
              <Button variant="ghost" size="xs" onClick={clearFilters}>
                <XIcon className="size-3" />
                Clear
              </Button>
            )}
          </div>
          <FilterFields filters={filters} onChange={handleChange} />
        </div>
      </aside>

      {/* Mobile filter sheet */}
      <div className="lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <Button variant="outline" size="sm">
                <SlidersHorizontalIcon className="size-4" />
                Filters
                {hasActiveFilters && (
                  <Badge className="ml-1 size-5 rounded-full p-0 text-[10px]">
                    !
                  </Badge>
                )}
              </Button>
            }
          />
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto p-4">
              <FilterFields filters={filters} onChange={handleChange} />
              <div className="mt-4 flex gap-2">
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={clearFilters}
                  >
                    Clear All
                  </Button>
                )}
                <Button
                  className="flex-1"
                  onClick={() => setMobileOpen(false)}
                >
                  Apply
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}

// Simple Badge for mobile filter indicator - inline to avoid circular deps
function Badge({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center justify-center bg-primary text-primary-foreground text-xs font-medium ${className ?? ''}`}
    >
      {children}
    </span>
  )
}
