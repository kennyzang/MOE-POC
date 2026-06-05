import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import type { StudentSearchResult } from '../types'

/**
 * Debounced student search used by Exams, SEN, Library and any other page
 * that needs a "type to search" student dropdown.
 *
 * Returns an empty array while the term is shorter than 2 characters so the
 * dropdown stays quiet until the user has typed something meaningful.
 */
export function useStudentSearch(term: string) {
  return useQuery({
    queryKey: ['students-search', term],
    queryFn: async (): Promise<StudentSearchResult[]> => {
      const { data } = await api.get<{ data: StudentSearchResult[] }>(
        `/students?search=${encodeURIComponent(term)}&limit=20`
      )
      return data.data
    },
    enabled: term.length >= 2,
    placeholderData: [],
  })
}
