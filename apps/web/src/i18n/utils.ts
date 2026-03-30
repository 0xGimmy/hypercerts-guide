import en from './en.json'
import zh from './zh.json'

const messages: Record<string, Record<string, any>> = { en, zh }

export function t(locale: string, key: string): string {
  const keys = key.split('.')
  let value: any = messages[locale] ?? messages.zh
  for (const k of keys) {
    value = value?.[k]
  }
  return typeof value === 'string' ? value : key
}
