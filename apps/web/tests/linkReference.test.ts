import { describe, expect, it } from 'vitest'

import { createLinkReferenceDocument } from '../src/runtime/v07UiContracts'

describe('Link Reference document', () => {
  it('classifies a Feishu document and keeps user-authored context metadata', () => {
    const result = createLinkReferenceDocument({
      url: 'https://example.feishu.cn/docx/ABC123',
      title: '客户反馈',
      description: '第二轮反馈原文',
      purpose: '作为脚本修改的正式参考',
    })

    expect(result).toMatchObject({
      fileName: '客户反馈.link.md',
      provider: 'feishu',
      resourceType: 'document',
    })
    expect(result.markdown).toContain('sourceKind: feishu_link')
    expect(result.markdown).toContain('url: https://example.feishu.cn/docx/ABC123')
    expect(result.markdown).toContain('作为脚本修改的正式参考')
    expect(result.markdown).toContain('do not claim the page was read')
  })

  it('rejects non-web protocols', () => {
    expect(() => createLinkReferenceDocument({
      url: 'file:///C:/secret.txt',
      title: 'unsafe',
      description: '',
      purpose: '',
    })).toThrow('HTTP or HTTPS')
  })
})
