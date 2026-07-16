import type { DemoAsset } from '../types/evaluation'

export const demoAssets: DemoAsset[] = [
  {
    id: 'portasplit-thinker-v3',
    projectId: 'portasplit-thinker',
    title: 'PortaSplit / The Thinker',
    version: 'V3',
    kind: 'video',
    brief: '以炎热场景建立需求，自然表达便捷安装与强劲制冷。',
    generationContext: '商业短视频 · 00:30 · 16:9 · 24fps',
    source: 'demo-video',
  },
  {
    id: 'product-kv-v2',
    projectId: 'product-kv',
    title: 'Product KV / V2',
    version: 'V2',
    kind: 'image',
    brief: '保持产品结构准确，以克制材质表达便携与专业感。',
    generationContext: '产品 KV · 2048 × 1365 · 静态图像',
    source: 'demo-image',
  },
]
