import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@/locales/en'
import zh from '@/locales/zh'
import ms from '@/locales/ms'

function getStoredLanguage(): 'en' | 'zh' | 'ms' {
  try {
    const raw = localStorage.getItem('moe-lang')
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { language?: string } }
      const lang = parsed?.state?.language
      if (lang === 'en' || lang === 'zh' || lang === 'ms') return lang
    }
  } catch { /* ignore */ }
  return 'en'
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
    ms: { translation: ms },
  },
  lng: getStoredLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
