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
import { SlidersHorizontalIcon } from 'lucide-react'

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

const URGENCY_LABELS: Record<string, string> = {
  normal: 'Normal',
  high: 'High',
  critical: 'Critical',
}

const STATE_LABELS: Record<string, string> = US_STATES.reduce<Record<string, string>>(
  (acc, s) => {
    acc[s.value] = s.label
    return acc
  },
  {},
)

export interface ActiveFilterChip {
  key: keyof JobFilters
  label: string
}

/**
 * Walk the filters and produce a chip per active value (skipping search + sort,
 * which have their own UI). Returns [] when no filters are active.
 */
export function getActiveFilterChips(filters: JobFilters): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = []
  if (filters.contractor_type) {
    chips.push({
      key: 'contractor_type',
      label:
        CONTRACTOR_TYPE_LABELS[
          filters.contractor_type as keyof typeof CONTRACTOR_TYPE_LABELS
        ] ?? filters.contractor_type,
    })
  }
  if (filters.job_type) {
    chips.push({
      key: 'job_type',
      label:
        JOB_TYPE_LABELS[filters.job_type as keyof typeof JOB_TYPE_LABELS] ??
        filters.job_type,
    })
  }
  if (filters.shift_type) {
    chips.push({
      key: 'shift_type',
      label:
        SHIFT_TYPE_LABELS[
          filters.shift_type as keyof typeof SHIFT_TYPE_LABELS
        ] ?? filters.shift_type,
    })
  }
  if (filters.state) {
    chips.push({ key: 'state', label: STATE_LABELS[filters.state] ?? filters.state })
  }
  if (filters.city) {
    chips.push({ key: 'city', label: filters.city })
  }
  if (filters.pay_min || filters.pay_max) {
    const min = filters.pay_min || '0'
    const max = filters.pay_max || '∞'
    chips.push({ key: 'pay_min', label: `$${min}–${max}/hr` })
  }
  if (filters.start_date) {
    chips.push({ key: 'start_date', label: `From ${filters.start_date}` })
  }
  if (filters.urgency) {
    chips.push({
      key: 'urgency',
      label: `${URGENCY_LABELS[filters.urgency] ?? filters.urgency} urgency`,
    })
  }
  return chips
}

/** Reset a single filter key to its default. pay_min also clears pay_max. */
export function clearFilterKey(
  filters: JobFilters,
  key: keyof JobFilters,
): JobFilters {
  if (key === 'pay_min') {
    return { ...filters, pay_min: '', pay_max: '' }
  }
  return { ...filters, [key]: defaultFilters[key] }
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
          <span className="text-[#62646a]">–</span>
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

/**
 * The Filters trigger button — opens a side Sheet containing the full filter
 * set. Only one variant; the page renders just this single button next to the
 * search input. Active filter chips are rendered by the page itself via
 * {@link getActiveFilterChips}.
 */
export function JobSearchFilters({
  filters,
  onFilterChange,
}: JobSearchFiltersProps) {
  const [open, setOpen] = useState(false)
  const activeCount = getActiveFilterChips(filters).length

  const handleChange = (key: keyof JobFilters, value: string) => {
    onFilterChange({ ...filters, [key]: value })
  }

  const clearAll = () => {
    onFilterChange({
      ...defaultFilters,
      search: filters.search,
      sort: filters.sort,
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" className="gap-2">
            <SlidersHorizontalIcon className="size-4" />
            Filters
            {activeCount > 0 && (
              <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-[#1dbf73] text-[10px] font-semibold text-white">
                {activeCount}
              </span>
            )}
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto px-4 pb-4">
          <FilterFields filters={filters} onChange={handleChange} />
          <div className="mt-6 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={clearAll}
              disabled={activeCount === 0}
            >
              Clear all
            </Button>
            <Button
              className="flex-1 bg-[#1dbf73] text-white hover:bg-[#19a463]"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
