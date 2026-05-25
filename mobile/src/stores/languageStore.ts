import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import i18n from '@/lib/i18n'

type Language = 'en' | 'zh' | 'ms'

interface LanguageStore {
  language: Language
  setLanguage: (lang: Language) => void
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    set => ({
      language: 'en' as Language,
      setLanguage: (language) => {
        set({ language })
        void i18n.changeLanguage(language)
      },
    }),
    { name: 'moe-lang' }
  )
)
