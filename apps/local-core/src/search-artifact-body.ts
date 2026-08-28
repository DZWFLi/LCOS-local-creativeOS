/**
 * F6 后端同步施工单 P0-A3（20260828）：artifact 正文读取共享层。
 *
 * ProjectSearchService（懒索引 repair）与 SemanticIndexService（mutation-driven
 * reindex）共用同一套「当前 revision 正文」读取规则，避免两处各读各的漂移：
 * - text/markdown | text/plain：直读全文（前缀上限由调用方决定）；
 * - application/pdf：pdfjs-dist 提取页文本，页间以 \f 连接（chunkEntity 的
 *   planPageChunks 约定 → anchor 形如 pdf:p3 / pdf:p3-p5），页数上限保护；
 * - 图片（png/jpg/jpeg/webp/gif/bmp）：正文 = OCR evidence（显式跑过 /runtime/ocr
 *   落库）；没有 evidence 时返回空串——绝不拿 filename 冒充图片语义索引。
 * - 其余类型（docx/pptx 等）：空串（标题块仍可检索），等选型后接入。
 */
import { open, readFile } from 'node:fs/promises'

export interface ArtifactBodyFileRecord {
  readonly mimeType?: string
  readonly observedPath?: string
}

/** PDF 页文本提取的页数上限（写路径同步提文本的保护；超大 PDF 截断不失败）。 */
const PDF_EXTRACT_PAGE_LIMIT = 200
/** 单页提取文本字符上限。 */
const PDF_PAGE_CHAR_LIMIT = 20_000

const IMAGE_MIME_PREFIX = 'image/'
const TEXT_MIME_TYPES = new Set(['text/markdown', 'text/plain'])

export interface OcrEvidenceLookup {
  (projectId: string, artifactId: string): string | undefined
}

async function readTextPrefix(observedPath: string | undefined, maxChars: number): Promise<string> {
  if (observedPath === undefined) return ''
  try {
    const handle = await open(observedPath, 'r')
    try {
      const buffer = Buffer.alloc(maxChars * 4 + 4)
      const { bytesRead } = await handle.read(buffer, 0, buffer.byteLength, 0)
      return buffer.subarray(0, bytesRead).toString('utf8')
    } finally {
      await handle.close()
    }
  } catch {
    return ''
  }
}

/**
 * PDF 页文本提取（pdfjs-dist，node 端与 preview-worker 同一使用模式）。
 * 返回页文本以 \f 连接的单串；无文本层（纯扫描件）返回空串——OCR 是它的正道。
 */
export async function extractPdfPageText(observedPath: string): Promise<string> {
  const { getDocument } = await import('pdfjs-dist')
  const data = new Uint8Array(await readFile(observedPath))
  const doc = await getDocument({ data, useSystemFonts: true }).promise
  try {
    const pageCount = Math.min(doc.numPages, PDF_EXTRACT_PAGE_LIMIT)
    const pages: string[] = []
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await doc.getPage(pageNumber)
      try {
        const content = await page.getTextContent()
        const text = content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, PDF_PAGE_CHAR_LIMIT)
        pages.push(text)
      } finally {
        void page.cleanup()
      }
    }
    return pages.join('\f')
  } finally {
    await doc.destroy().catch(() => undefined)
  }
}

/**
 * 读 artifact 当前正文（供检索索引用）。
 * @param maxChars markdown/plain 的读取前缀上限（PDF 页文本受页/字符上限约束）。
 * @param ocrEvidence 图片正文来源：显式 OCR evidence 查表函数；缺省无 OCR。
 */
export async function readArtifactIndexBody(input: {
  readonly fileRecord: ArtifactBodyFileRecord | undefined
  readonly maxChars?: number
  readonly ocrEvidence?: OcrEvidenceLookup
  readonly projectId?: string
  readonly artifactId?: string
}): Promise<string> {
  const fileRecord = input.fileRecord
  if (fileRecord === undefined || fileRecord.observedPath === undefined) return ''
  const mimeType = fileRecord.mimeType ?? ''
  if (TEXT_MIME_TYPES.has(mimeType)) {
    return readTextPrefix(fileRecord.observedPath, input.maxChars ?? 200_000)
  }
  if (mimeType === 'application/pdf') {
    try {
      return await extractPdfPageText(fileRecord.observedPath)
    } catch {
      return '' // 损坏/加密 PDF：标题块仍可检索，正文诚实缺席
    }
  }
  if (mimeType.startsWith(IMAGE_MIME_PREFIX) && input.ocrEvidence !== undefined
    && input.projectId !== undefined && input.artifactId !== undefined) {
    return input.ocrEvidence(input.projectId, input.artifactId) ?? ''
  }
  return ''
}
