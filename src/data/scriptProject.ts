import type { AiReviewDraft, ScriptProject, ScriptReviewItem } from '../types/evaluation'

const v1Segments = [
  {
    id: 'hook', order: 1, timeRange: '00–03s', title: 'HOOK', status: 'reviewed' as const,
    visual: '原创男性石膏像保持托腮沉思，镜头从面部特写缓慢拉出。',
    action: '人物眉头紧锁，右手连续扇风并拉扯衣领。',
    dialogue: 'TOO HOT TO THINK?',
    prompt: 'Slow pull-out from statue face, hot room, repeated fanning and collar pulling.',
  },
  {
    id: 'heat-setup', order: 2, timeRange: '03–06s', title: 'HEAT SETUP', status: 'open' as const,
    visual: '镜头继续拉出，露出完整客厅与右侧 PortaSplit。',
    action: '雕像突然站起，径直走向产品。',
    dialogue: '',
    prompt: 'Continue pull-out, statue suddenly stands and walks to PortaSplit.',
  },
  {
    id: 'product-setup', order: 3, timeRange: '06–09s', title: 'PRODUCT SETUP', status: 'open' as const,
    visual: '人物打开玻璃门，把外机搬到阳台，再整理冷媒管。',
    action: '连续完成搬运、落地、理管与关门。',
    dialogue: '3-STEP SELF-INSTALL',
    prompt: 'Show full installation process continuously with all actions visible.',
  },
  {
    id: 'cooling-payoff', order: 4, timeRange: '09–12s', title: 'COOLING PAYOFF', status: 'reviewed' as const,
    visual: '人物轻触顶部开关，挡风板开启。',
    action: '纱帘与长袍边缘轻微摆动，人物肩颈放松。',
    dialogue: 'SIMPLE SETUP. POWERFUL COOLING.',
    prompt: 'Single touch, air outlet opens, subtle curtain movement, relaxed statue.',
  },
  {
    id: 'end-card', order: 5, timeRange: '12–15s', title: 'END CARD', status: 'approved' as const,
    visual: '雕像坐回石座恢复沉思，产品在右侧自然运行。',
    action: '保持安静舒适状态，玻璃门关闭。',
    dialogue: 'PORTASPLIT',
    prompt: 'Premium home hero shot, statue remains narrative focus, product runs naturally.',
  },
]

const v2Segments = v1Segments.map((segment) => ({ ...segment }))
v2Segments[0] = { ...v2Segments[0], action: '左手保持托腮，右手只做一次短促扇风动作。' }
v2Segments[1] = { ...v2Segments[1], action: '人物先感受到持续热压，再起身看向玻璃门方向。', prompt: 'Maintain pull-out; one clear heat reaction motivates the character to stand.' }
v2Segments[2] = { ...v2Segments[2], visual: '三个独立切镜分别表现外机移出、理管关门、单指启动。', action: '每个镜头只承担一个安装信息点。', prompt: 'Three distinct advertising cuts: move outdoor unit, arrange pipe and close door, single-touch start.' }

export const scriptProject: ScriptProject = {
  id: 'portasplit-thinker',
  title: 'PortaSplit / The Thinker',
  recipe: 'brand-film',
  brief: {
    objective: '表达安装简单和强劲制冷，让产品自然进入人物行为因果链。',
    audience: 'European renters',
    platform: 'TikTok / Reels',
    format: 'Vertical Product Film',
    duration: '15s',
    lockedElements: ['石膏像角色设定', '0–6 秒持续拉镜', '6 秒完整露出产品'],
  },
  versions: [
    { id: 'script-v1', label: 'Script V1', note: '初始创意稿', status: 'draft', segments: v1Segments },
    { id: 'script-v2', label: 'Script V2', note: '客户反馈修改稿', status: 'revised', segments: v2Segments },
    { id: 'script-v3', label: 'Script V3', note: '当前采用', status: 'current', segments: v2Segments.map((segment) => ({ ...segment })) },
  ],
}

export const initialScriptReviews: ScriptReviewItem[] = [
  {
    id: 'review-motivation', versionId: 'script-v3', segmentId: 'heat-setup', category: 'Character Motivation',
    issue: '人物突然起身安装，行为动机不成立。',
    impact: '需求尚未建立，产品出现像强行植入。',
    suggestion: '在起身前加入一次明确但克制的热感动作。',
    authorType: 'human', status: 'accepted', decisionAction: 'modify',
  },
  {
    id: 'review-installation', versionId: 'script-v3', segmentId: 'product-setup', category: 'Product Communication',
    issue: '三步安装被写成连续教学过程。',
    impact: 'Simple setup 的卖点被动作数量稀释。',
    suggestion: '拆成三个独立广告切镜，每个镜头只传达一个信息点。',
    authorType: 'human', status: 'open', decisionAction: 'modify',
  },
  {
    id: 'review-payoff', versionId: 'script-v3', segmentId: 'cooling-payoff', category: 'Brand Fit',
    issue: '制冷反馈表达克制，符合品牌片气质。',
    impact: '产品效果可理解，同时没有落入夸张蓝色气流。',
    suggestion: '保留纱帘、长袍和人物放松状态作为制冷证据。',
    authorType: 'ai', status: 'resolved', decisionAction: 'keep',
  },
]

export const initialAiDrafts: AiReviewDraft[] = scriptProject.versions[2].segments.map((segment) => ({
  segmentId: segment.id,
  findings: segment.id === 'heat-setup'
    ? [
        { skill: 'Character Motivation', finding: '未检测到从炎热状态到安装行为的充分因果过渡。' },
        { skill: 'Product Communication', finding: '产品出现清晰，但需求触发不足。' },
      ]
    : [{ skill: 'Brief Alignment', finding: '当前段落与 Brief 基本对齐，建议人工确认表达强度。' }],
  originalText: segment.id === 'heat-setup'
    ? '产品出现前缺少明确的需求触发。'
    : '未发现阻塞性商业逻辑问题。',
  humanRevision: segment.id === 'heat-setup'
    ? '问题不只是需求触发不足，而是雕像站起安装的行为转折太突然。需要先建立热感，再让产品进入因果链。'
    : '',
  disposition: 'pending', confidence: segment.id === 'heat-setup' ? 'high' : 'medium', updatedAt: null,
}))
