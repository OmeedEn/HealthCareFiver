'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isDemoMode, DEMO_JOBS } from '@/lib/demo/data'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { JobCard, type JobCardData } from '@/components/jobs/job-card'
import {
  JobSearchFilters,
  defaultFilters,
  getActiveFilterChips,
  clearFilterKey,
  type JobFilters,
} from '@/components/jobs/job-search-filters'
import { SearchIcon, Loader2, BriefcaseIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'

const PAGE_SIZE = 12

export default function ContractorJobsPage() {
  const [jobs, setJobs] = useState<JobCardData[]>([])
  const [filters, setFilters] = useState<JobFilters>(defaultFilters)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set())
  const [filtersForCurrentPage, setFiltersForCurrentPage] =
    useState<JobFilters>(defaultFilters)

  if (filters !== filtersForCurrentPage) {
    setFiltersForCurrentPage(filters)
    setPage(0)
  }

  const fetchJobs = useCallback(
    async (pageNum: number, append = false) => {
      if (isDemoMode()) {
        // In demo mode, do client-side filtering against DEMO_JOBS
        const demoJobs: JobCardData[] = (DEMO_JOBS as Record<string, unknown>[]).map((job) => {
          const facility = job.facility as { facility_name: string } | null
          return {
            id: job.id as string,
            title: job.title as string,
            facility_name: facility?.facility_name ?? null,
            city: job.city as string | null,
            state: job.state as string | null,
            pay_rate_min: job.pay_rate_min as number | null,
            pay_rate_max: job.pay_rate_max as number | null,
            pay_rate_type: job.pay_rate_type as string | null,
            job_type: job.job_type as string | null,
            shift_type: job.shift_type as string | null,
            urgency: job.urgency as string | null,
            published_at: job.published_at as string | null,
            created_at: job.created_at as string,
            total_applicants: job.total_applicants as number | null,
            is_remote: job.is_remote as boolean | null,
          }
        })

        let filtered = demoJobs
        if (filters.search.trim()) {
          const q = filters.search.trim().toLowerCase()
          filtered = filtered.filter(
            (j) =>
              j.title.toLowerCase().includes(q) ||
              (j.facility_name?.toLowerCase().includes(q) ?? false)
          )
        }
        if (filters.job_type) {
          filtered = filtered.filter((j) => j.job_type === filters.job_type)
        }
        if (filters.shift_type) {
          filtered = filtered.filter((j) => j.shift_type === filters.shift_type)
        }
        if (filters.state) {
          filtered = filtered.filter((j) => j.state === filters.state)
        }

        setJobs(filtered)
        setHasMore(false)
        setLoading(false)
        setLoadingMore(false)
        return
      }

      if (pageNum === 0) setLoading(true)
      else setLoadingMore(true)

      try {
        const supabase = createClient()
        let query = supabase
          .from('jobs')
          .select(
            'id, title, city, state, pay_rate_min, pay_rate_max, pay_rate_type, job_type, shift_type, urgency, published_at, created_at, total_applicants, is_remote, facility_profiles!inner(facility_name)'
          )
          .eq('status', 'open')

        // Text search
        if (filters.search.trim()) {
          query = query.textSearch('search_vector', filters.search.trim())
        }

        // Apply filters
        if (filters.contractor_type) {
          query = query.eq('contractor_type', filters.contractor_type)
        }
        if (filters.job_type) {
          query = query.eq('job_type', filters.job_type)
        }
        if (filters.shift_type) {
          query = query.eq('shift_type', filters.shift_type)
        }
        if (filters.state) {
          query = query.eq('state', filters.state)
        }
        if (filters.city) {
          query = query.ilike('city', `%${filters.city}%`)
        }
        if (filters.pay_min) {
          query = query.gte('pay_rate_max', parseFloat(filters.pay_min))
        }
        if (filters.pay_max) {
          query = query.lte('pay_rate_min', parseFloat(filters.pay_max))
        }
        if (filters.start_date) {
          query = query.gte('start_date', filters.start_date)
        }
        if (filters.urgency) {
          query = query.eq('urgency', filters.urgency)
        }

        // Sort
        switch (filters.sort) {
          case 'pay_high':
            query = query.order('pay_rate_max', {
              ascending: false,
              nullsFirst: false,
            })
            break
          case 'urgency':
            query = query.order('urgency', { ascending: false })
            break
          case 'newest':
          default:
            query = query.order('published_at', {
              ascending: false,
              nullsFirst: false,
            })
            break
        }

        query = query.range(
          pageNum * PAGE_SIZE,
          (pageNum + 1) * PAGE_SIZE - 1
        )

        const { data, error } = await query

        if (error) {
          toast.error('Failed to load jobs.')
          return
        }

        const mapped: JobCardData[] = (data ?? []).map((row: Record<string, unknown>) => {
          const facility = row.facility_profiles as { facility_name: string } | null
          return {
            id: row.id as string,
            title: row.title as string,
            facility_name: facility?.facility_name ?? null,
            city: row.city as string | null,
            state: row.state as string | null,
            pay_rate_min: row.pay_rate_min as number | null,
            pay_rate_max: row.pay_rate_max as number | null,
            pay_rate_type: row.pay_rate_type as string | null,
            job_type: row.job_type as string | null,
            shift_type: row.shift_type as string | null,
            urgency: row.urgency as string | null,
            published_at: row.published_at as string | null,
            created_at: row.created_at as string,
            total_applicants: row.total_applicants as number | null,
            is_remote: row.is_remote as boolean | null,
          }
        })

        setHasMore(mapped.length === PAGE_SIZE)

        if (append) {
          setJobs((prev) => [...prev, ...mapped])
        } else {
          setJobs(mapped)
        }
      } catch {
        toast.error('An unexpected error occurred.')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [filters]
  )

  // Load saved jobs
  useEffect(() => {
    if (isDemoMode()) return
    const loadSaved = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('saved_jobs')
        .select('job_id')
        .eq('contractor_id', user.id)

      if (data) {
        setSavedJobIds(new Set(data.map((r) => r.job_id)))
      }
    }
    loadSaved()
  }, [])

  // Fetch jobs when filters change (page reset handled during render).
  useEffect(() => {
    fetchJobs(0)
  }, [fetchJobs])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchJobs(nextPage, true)
  }

  const handleSave = async (jobId: string) => {
    if (isDemoMode()) {
      if (savedJobIds.has(jobId)) {
        setSavedJobIds((prev) => {
          const next = new Set(prev)
          next.delete(jobId)
          return next
        })
        toast.success('Job removed from saved.')
      } else {
        setSavedJobIds((prev) => new Set(prev).add(jobId))
        toast.success('Job saved!')
      }
      return
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      toast.error('You must be logged in to save jobs.')
      return
    }

    if (savedJobIds.has(jobId)) {
      await supabase
        .from('saved_jobs')
        .delete()
        .eq('contractor_id', user.id)
        .eq('job_id', jobId)
      setSavedJobIds((prev) => {
        const next = new Set(prev)
        next.delete(jobId)
        return next
      })
      toast.success('Job removed from saved.')
    } else {
      await supabase
        .from('saved_jobs')
        .insert({ contractor_id: user.id, job_id: jobId })
      setSavedJobIds((prev) => new Set(prev).add(jobId))
      toast.success('Job saved!')
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#404145]">Find Jobs</h1>
        <p className="text-[#62646a]">
          Browse and search open healthcare positions
        </p>
      </div>

      {/* Search bar, sort, and filter trigger */}
      <Card>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <form
              onSubmit={handleSearchSubmit}
              className="relative flex-1"
              role="search"
            >
              <label htmlFor="contractor-job-search" className="sr-only">
                Search jobs
              </label>
              <SearchIcon
                aria-hidden="true"
                className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#6b7280]"
              />
              <Input
                id="contractor-job-search"
                type="search"
                placeholder="Search jobs by title, description, specialty..."
                className="pl-9"
                value={filters.search}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, search: e.target.value }))
                }
              />
            </form>
            <div className="flex items-center gap-2">
              <Select
                value={filters.sort}
                onValueChange={(v) => setFilters((f) => ({ ...f, sort: v ?? '' }))}
              >
                <SelectTrigger
                  className="w-40"
                  aria-label="Sort jobs by"
                >
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="pay_high">Highest Pay</SelectItem>
                  <SelectItem value="urgency">Most Urgent</SelectItem>
                </SelectContent>
              </Select>
              <JobSearchFilters filters={filters} onFilterChange={setFilters} />
            </div>
          </div>

          {(() => {
            const chips = getActiveFilterChips(filters)
            if (chips.length === 0) return null
            return (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {chips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setFilters((f) => clearFilterKey(f, chip.key))}
                    className="inline-flex items-center gap-1 rounded-full bg-[#e8faf1] px-3 py-1 text-xs font-medium text-[#0f8f56] hover:bg-[#d3f4e3]"
                  >
                    {chip.label}
                    <XIcon className="size-3" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setFilters({
                      ...defaultFilters,
                      search: filters.search,
                      sort: filters.sort,
                    })
                  }
                  className="ml-1 text-xs font-medium text-[#62646a] hover:text-[#404145] hover:underline"
                >
                  Clear all
                </button>
              </div>
            )
          })()}
        </CardContent>
      </Card>

      {/* Results */}
      <div className="min-w-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-[#1dbf73]" />
            </div>
          ) : jobs.length === 0 ? (
            <Card>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-[#e8faf1]">
                    <BriefcaseIcon className="size-6 text-[#1dbf73]" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-[#404145]">
                    No jobs found
                  </h3>
                  <p className="mt-1 text-sm text-[#62646a]">
                    Try adjusting your search or filters.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    showSave
                    isSaved={savedJobIds.has(job.id)}
                    onSave={handleSave}
                  />
                ))}
              </div>
              {hasMore && (
                <div className="mt-6 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore && (
                      <Loader2 className="size-4 animate-spin text-[#1dbf73]" />
                    )}
                    Load More
                  </Button>
                </div>
              )}
            </>
          )}
      </div>
    </div>
  )
}
