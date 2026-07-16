import type { AiReviewDraft, DecisionRecord, ScriptProject, ScriptReviewItem, ScriptSegment } from '../types/evaluation'

const projectId = 'portasplit-thinker'
const makeSegments = (versionId: string): ScriptSegment[] => [
  { id: 'hook', versionId, order: 1, timeStart: 0, timeEnd: 3, beatName: 'HOOK', purpose: '建立炎热困境与角色记忆点', visual: '原创男性石膏像保持托腮沉思，镜头从面部特写缓慢拉出。', action: '人物眉头紧锁，右手连续扇风并拉扯衣领。', super: 'TOO HOT TO THINK?', productRole: '暂不露出，为需求蓄势', lockedElements: ['石膏像角色设定', '持续拉镜'], status: 'revised' },
  { id: 'heat-setup', versionId, order: 2, timeStart: 3, timeEnd: 6, beatName: 'HEAT SETUP', purpose: '把热感转成寻找解决方案的动机', visual: '镜头继续拉出，露出完整客厅与右侧 PortaSplit。', action: '雕像突然站起，径直走向产品。', productRole: '首次完整露出', lockedElements: ['0–6 秒持续拉镜', '6 秒完整露出产品'], status: 'reviewing' },
  { id: 'product-setup', versionId, order: 3, timeStart: 6, timeEnd: 9, beatName: 'PRODUCT SETUP', purpose: '用三步证明自行安装简单', visual: '人物打开玻璃门，把外机搬到阳台，再整理冷媒管。', action: '连续完成搬运、落地、理管与关门。', super: '3-STEP SELF-INSTALL', productRole: '解决方案与动作主角', lockedElements: ['室内外机关系真实', '冷媒管连接连续'], status: 'reviewing' },
  { id: 'cooling-payoff', versionId, order: 4, timeStart: 9, timeEnd: 12, beatName: 'COOLING PAYOFF', purpose: '给出克制但可感知的制冷回报', visual: '人物轻触顶部开关，挡风板开启。', action: '纱帘与长袍边缘轻微摆动，人物肩颈放松。', super: 'SIMPLE SETUP. POWERFUL COOLING.', productRole: '兑现强劲制冷', lockedElements: ['无夸张蓝色气流'], status: 'accepted' },
  { id: 'end-card', versionId, order: 5, timeStart: 12, timeEnd: 15, beatName: 'END CARD', purpose: '锁定品牌与舒适生活状态', visual: '雕像坐回石座恢复沉思，产品在右侧自然运行。', action: '保持安静舒适状态，玻璃门关闭。', super: 'PORTASPLIT', productRole: 'Hero Shot 中自然共存', lockedElements: ['玻璃门关闭', '外机位于阳台'], status: 'accepted' },
]

const v1Segments = makeSegments('script-v1')
const v2Segments = makeSegments('script-v2')
v2Segments[0] = { ...v2Segments[0], action: '左手保持托腮，右手只做一次短促扇风动作。' }
v2Segments[1] = { ...v2Segments[1], action: '人物先感受到持续热压，再起身看向玻璃门方向。' }
v2Segments[2] = { ...v2Segments[2], visual: '三个独立切镜分别表现外机移出、理管关门、单指启动。', action: '每个镜头只承担一个安装信息点。' }
const v3Segments = v2Segments.map((segment) => ({ ...segment, versionId: 'script-v3' }))

export const scriptProject: ScriptProject = {
  id: projectId, title: 'PortaSplit / The Thinker', recipe: 'brand-film',
  brief: {
    objective: '表达安装简单和强劲制冷，让产品自然进入人物行为因果链。', audience: '欧洲租房用户', platform: 'TikTok / Reels', format: '9:16 Vertical Product Film', duration: '15s',
    productBenefits: ['3-step self-install', 'Simple setup. Powerful cooling.'], mandatoryMessages: ['三步安装', '室内机与外机的真实关系'], forbiddenElements: ['传统分体空调对比', '复杂工具', '夸张蓝色冷气'], deliverables: ['客户脚本', '分镜', '生成与制作商执行材料'], lockedElements: ['石膏像角色设定', '0–6 秒持续拉镜', '6 秒完整露出产品'],
  },
  creativeDirection: { directionTitle: '思考者也热到无法思考', coreInsight: '炎热会打断最专注的状态，租房用户需要无需复杂施工的即时解法。', creativeMechanism: '用经典沉思姿态被热打断的反差，引出三步自安装。', productRole: '让人物从烦躁恢复沉思的解决方案。', storyArc: '热到无法思考 → 自救无效 → 发现并安装 PortaSplit → 恢复沉思', visualTone: '现代欧洲客厅，雕塑感、克制、高级，制冷效果写实。', adoptedReason: '角色、产品利益点和 15 秒行为因果可形成一条清晰链路。' },
  versions: [
    { id: 'script-v1', projectId, versionLabel: 'Script V1', title: '冰块自救初稿', summary: '初始创意稿', changeReason: '建立首个完整创意快照。', feedbackIds: [], segments: v1Segments, status: 'draft', createdAt: '2026-07-10T10:00:00+08:00' },
    { id: 'script-v2', projectId, versionLabel: 'Script V2', title: '热感动作修改稿', summary: '客户反馈后改为扇风、扯长袍。', sourceVersionId: 'script-v1', changeReason: '冰块缺乏来源，改用人物自身热感动作。', feedbackIds: ['review-motivation'], decisionId: 'decision-v1', segments: v2Segments, status: 'client_review', createdAt: '2026-07-12T10:00:00+08:00' },
    { id: 'script-v3', projectId, versionLabel: 'Script V3', title: '制作交接候选稿', summary: '优化动作、安装三切镜和尾帧状态。', sourceVersionId: 'script-v2', changeReason: '强化动机、简化安装表达并锁定产品物理关系。', feedbackIds: ['review-installation', 'review-payoff'], decisionId: 'decision-v3', segments: v3Segments, status: 'current', createdAt: '2026-07-15T10:00:00+08:00' },
  ],
}

export const initialScriptReviews: ScriptReviewItem[] = [
  { id: 'review-motivation', versionId: 'script-v3', segmentId: 'heat-setup', category: 'Character Motivation', issue: '人物突然起身安装，行为动机不成立。', businessImpact: '需求尚未建立，产品出现像强行植入。', evidenceText: '雕像从托腮直接切换为起身走向产品，中间没有明确热感反应。', suggestion: '在起身前加入一次明确但克制的热感动作。', authorType: 'human', status: 'accepted', decisionAction: 'modify' },
  { id: 'review-installation', versionId: 'script-v3', segmentId: 'product-setup', category: 'Product Communication', issue: '三步安装被写成连续教学过程。', businessImpact: 'Simple setup 的卖点被动作数量稀释。', evidenceText: '同一段连续包含搬运、落地、理管、关门等多个动作。', suggestion: '拆成三个独立广告切镜，每个镜头只传达一个信息点。', authorType: 'human', status: 'open', decisionAction: 'modify' },
  { id: 'review-payoff', versionId: 'script-v3', segmentId: 'cooling-payoff', category: 'Brand Fit', issue: '制冷反馈表达克制，符合品牌片气质。', businessImpact: '产品效果可理解，同时没有落入夸张蓝色气流。', evidenceText: '纱帘、长袍边缘和人物肩颈放松共同构成制冷证据。', suggestion: '保留当前制冷证据。', authorType: 'ai', status: 'resolved', decisionAction: 'keep' },
  { id: 'review-rejected-blue-air', versionId: 'script-v2', segmentId: 'cooling-payoff', category: 'Visual Effect', issue: '建议增加蓝色气流强化制冷。', businessImpact: '可能更直观，但会破坏高级写实调性。', evidenceText: 'Brief 明确禁止夸张蓝色冷气。', suggestion: '改用环境与人物状态变化表达。', authorType: 'ai', status: 'rejected', decisionAction: 'remove' },
]

export const initialAiDrafts: AiReviewDraft[] = v3Segments.map((segment) => ({ versionId: 'script-v3', segmentId: segment.id, findings: segment.id === 'heat-setup' ? [{ skill: 'Character Motivation', finding: '未检测到从炎热状态到安装行为的充分因果过渡。' }, { skill: 'Product Communication', finding: '产品出现清晰，但需求触发不足。' }] : [{ skill: 'Brief Alignment', finding: '当前段落与 Brief 基本对齐，建议人工确认表达强度。' }], originalText: segment.id === 'heat-setup' ? '产品出现前缺少明确的需求触发。' : '未发现阻塞性商业逻辑问题。', humanRevision: segment.id === 'heat-setup' ? '雕像站起安装的行为转折太突然，需要先建立热感。' : '', disposition: 'pending', confidence: segment.id === 'heat-setup' ? 'high' : 'medium', updatedAt: null }))

export const initialDecisions: DecisionRecord[] = [
  { id: 'decision-v1', versionId: 'script-v1', acceptedIssues: ['冰块道具缺乏来源'], rejectedIssues: [], keep: ['石膏像角色', '0–6 秒持续拉镜', '产品第 6 秒完整露出'], modify: ['用人物自身动作建立热感'], remove: ['冰块'], nextVersionGoal: '用扇风与拉衣领形成自然的热感行为链。', unresolvedQuestions: [], decisionSource: 'client', createdAt: '2026-07-11T18:00:00+08:00' },
  { id: 'decision-v2', versionId: 'script-v2', acceptedIssues: ['安装过程显得复杂', '外机出现逻辑需明确'], rejectedIssues: ['增加蓝色气流'], keep: ['石膏像角色', '持续拉镜', '克制的制冷反馈'], modify: ['人物比例', '安装镜头数量', '外机出现逻辑'], remove: ['复杂连续安装教学', '明显蓝色气流'], nextVersionGoal: '形成可交给制作商的三步安装脚本与稳定尾帧。', unresolvedQuestions: ['客户是否确认尾帧文案？'], decisionSource: 'ai-assisted', createdAt: '2026-07-14T18:00:00+08:00' },
  { id: 'decision-v3', versionId: 'script-v3', acceptedIssues: ['热感动作需要保持克制且有因果', '产品揭示必须发生在需求建立之后'], rejectedIssues: [], keep: ['原创男性石膏像', '0–6 秒持续拉镜', '6 秒完整露出产品', '室内外机物理关系'], modify: ['扇风与扯衣领的动作路径', '安装段拆成清晰三步'], remove: ['冰块道具', '复杂安装工具', '蓝色气流特效'], nextVersionGoal: '输出可直接用于分镜与生成提示词拆解的客户确认稿。', unresolvedQuestions: ['尾帧英文文案是否锁定？'], decisionSource: 'human', createdAt: '2026-07-15T12:00:00+08:00' },
]
