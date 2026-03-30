import { describe, it, expect } from 'vitest'
import { t } from '../i18n/utils'

describe('i18n', () => {
  it('returns zh translation for known key', () => {
    expect(t('zh', 'title')).toBe('台灣超讚指南')
  })

  it('returns en translation for known key', () => {
    expect(t('en', 'title')).toBe('Taiwan HyperAwesome Guidebook')
  })

  it('returns nested key value', () => {
    expect(t('zh', 'tabs.donate')).toBe('捐款')
    expect(t('en', 'tabs.donate')).toBe('Donate')
  })

  it('returns key itself for missing translation', () => {
    expect(t('en', 'nonexistent.key')).toBe('nonexistent.key')
  })

  it('falls back to zh for unknown locale', () => {
    expect(t('fr', 'title')).toBe('台灣超讚指南')
  })
})
