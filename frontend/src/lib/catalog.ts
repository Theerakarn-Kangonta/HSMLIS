import { useQuery } from '@tanstack/react-query'
import { api } from './api'

// The settings lists that many screens need. They change rarely, so they are kept for a while
// and refreshed when a settings page saves (it invalidates its own key).

const long = { staleTime: 5 * 60_000 }

export const useDepartments = () => useQuery({ queryKey: ['departments'], queryFn: api.departments.list, ...long })
export const useSpecimenTypes = () => useQuery({ queryKey: ['specimen-types'], queryFn: api.specimenTypes.list, ...long })
export const useLabTests = () => useQuery({ queryKey: ['lab-tests'], queryFn: api.labTests.list, ...long })
export const usePackages = () => useQuery({ queryKey: ['packages'], queryFn: api.packages.list, ...long })
export const useReferrers = () => useQuery({ queryKey: ['referrers'], queryFn: api.referrers.list, ...long })
export const useBranches = () => useQuery({ queryKey: ['branches'], queryFn: api.branches.list, ...long })
