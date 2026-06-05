import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/api'
import type { SchoolConfig } from '@/types'

const DEFAULT_SECONDARY: SchoolConfig = {
  id: '',
  name: 'School',
  code: 'SCH',
  authority: 'MOE',
  schoolType: 'secondary',
  gradeLevels: ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11'],
  programmes: ['Academic'],
  classLetters: ['A', 'B', 'C', 'D', 'E'],
}

/** Returns the current user's school configuration.
 *  System admins (no school) get sensible defaults.
 *  Falls back to user.school from the auth store (set at login) for instant access. */
export function useSchoolConfig(): SchoolConfig {
  const { user } = useAuthStore()

  const { data } = useQuery({
    queryKey: ['school-config', user?.schoolId],
    queryFn: async () => {
      const { data } = await api.get('/schools/mine')
      return data.data as SchoolConfig | null
    },
    enabled: !!user?.schoolId,
    staleTime: 5 * 60 * 1000,  // school config changes rarely — cache 5 min
  })

  // Priority: fetched data > school attached to user at login > defaults
  return data ?? user?.school ?? DEFAULT_SECONDARY
}

/** Authority display names and colours */
export const AUTHORITY_META: Record<string, { label: string; color: string }> = {
  MOE:     { label: 'Ministry of Education', color: '#165DFF' },
  MORA:    { label: 'Ministry of Religious Affairs', color: '#d48806' },
  PRIVATE: { label: 'Private', color: '#722ED1' },
}

/** School type display names */
export const SCHOOL_TYPE_LABEL: Record<string, string> = {
  primary:            'Primary School',
  secondary:          'Secondary School',
  pre_university:     'Pre-University',
  vocational:         'Vocational / Technical',
  religious_primary:  'Religious Primary (Agama)',
  religious_secondary:'Religious Secondary (Menengah Agama)',
  combined:           'Combined (Primary & Secondary)',
}
