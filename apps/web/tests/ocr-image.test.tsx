import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { computeFitRect, OcrImage } from '../src/features/ocr/OcrImage'

function imageLike(overrides: Partial<HTMLImageElement>): HTMLImageElement {
  return {
    naturalWidth: 800,
    naturalHeight: 200,
    ...overrides,
  } as HTMLImageElement
}

describe('OcrImage — 文字层坐标映射', () => {
  it('fill：原始像素直接等比铺满', () => {
    const original = globalThis.getComputedStyle
    globalThis.getComputedStyle = (() => ({ objectFit: 'fill' })) as unknown as typeof getComputedStyle
    try {
      const rect = computeFitRect(imageLike({}), { width: 400, height: 200 })
      expect(rect).toEqual({ x: 0, y: 0, width: 400, height: 200 })
    } finally {
      globalThis.getComputedStyle = original
    }
  })

  it('contain：按比例居中完整显示', () => {
    const original = globalThis.getComputedStyle
    globalThis.getComputedStyle = (() => ({ objectFit: 'contain' })) as unknown as typeof getComputedStyle
    try {
      const rect = computeFitRect(imageLike({}), { width: 400, height: 200 })
      expect(rect).toEqual({ x: 0, y: 50, width: 400, height: 100 })
    } finally {
      globalThis.getComputedStyle = original
    }
  })

  it('cover：居中裁切', () => {
    const original = globalThis.getComputedStyle
    globalThis.getComputedStyle = (() => ({ objectFit: 'cover' })) as unknown as typeof getComputedStyle
    try {
      const rect = computeFitRect(imageLike({}), { width: 400, height: 200 })
      expect(rect).toEqual({ x: -200, y: 0, width: 800, height: 200 })
    } finally {
      globalThis.getComputedStyle = original
    }
  })
})

describe('OcrImage — 渲染不改变图片布局', () => {
  it('仅渲染 img，保留传入的 className 和 alt，不引入布局容器', () => {
    const html = renderToStaticMarkup(<OcrImage artifactId="a1" src="x.png" alt="测试图" className="extra-cls" />)
    expect(html).toContain('alt="测试图"')
    expect(html).toContain('class="extra-cls"')
    expect(html).not.toContain('lcos-ocr-overlay')
  })
})
