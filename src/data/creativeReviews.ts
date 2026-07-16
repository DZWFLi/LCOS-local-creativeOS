import type { CreativeReviewItem } from '../types/evaluation'

export const creativeReviewDimensions = [
  { id: 'conceptFit', label: '创意概念成立度', en: 'Concept Fit' },
  { id: 'brandFit', label: '品牌表达一致性', en: 'Brand Fit' },
  { id: 'productCommunication', label: '产品信息表达', en: 'Product Communication' },
  { id: 'platformFit', label: '平台内容适配', en: 'Platform Fit' },
  { id: 'visualExecution', label: '视觉执行质量', en: 'Visual Execution' },
  { id: 'aiReliability', label: 'AI 生成稳定性', en: 'AI Reliability' },
] as const

export const initialCreativeReviews: CreativeReviewItem[] = [
  {
    id: 'review-installation-clarity',
    assetId: 'portasplit-thinker-v3',
    category: 'productCommunication',
    issue: '三步安装被拆成了连续教学过程',
    impact: '“Simple setup”被九个动作稀释，产品反而显得安装复杂、费力。',
    evidence: 'Storyboard V2 · Shot 02–07 重复搬运与理管动作',
    suggestion: '压成三个独立广告切镜：外机移出、理管关门、单指启动；每个镜头只承担一个信息点。',
    status: 'open',
  },
  {
    id: 'review-hero-hierarchy',
    assetId: 'portasplit-thinker-v3',
    category: 'visualExecution',
    issue: '尾帧产品过大，叙事主次关系倒置',
    impact: '画面更像安装说明图，削弱石膏像创意角色与高级家居广告感。',
    evidence: 'Hero Shot V1 · 室内机前移并占据画面中心',
    suggestion: '先锁定尾帧：雕塑仍是叙事主角，产品退回右侧自然运行；外机与管路可理解但不抢镜。',
    status: 'accepted',
  },
  {
    id: 'review-product-continuity',
    assetId: 'portasplit-thinker-v3',
    category: 'aiReliability',
    issue: '内外机空间关系与产品身份漂移',
    impact: '外机像凭空出现或由室内机变形，破坏三步安装的物理可信度。',
    evidence: 'Storyboard V2 · Shot 03–04 外机尺寸、格栅方向与出现位置变化',
    suggestion: '明确外机开场藏在室内机后方；打开门后先露提手，再短距离移至阳台，室内机全程不动。',
    status: 'resolved',
  },
  {
    id: 'review-kv-hierarchy',
    assetId: 'product-kv-v2',
    category: 'visualExecution',
    issue: '产品功能区与氛围光竞争视觉焦点',
    impact: '第一眼无法快速识别产品结构，提案页的信息效率不足。',
    evidence: 'KV 主视觉 · 产品右上区域',
    suggestion: '降低背景高光，保留产品轮廓和关键结构的明暗层级。',
    status: 'open',
  },
]
