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
 * - docx/pptx（B6 P1-A）：fflate 解 zip 容器提取正文文本——docx 取 word/document.xml
 *   的 <w:t> run（段落间 \\n，anchor docx:pN）；pptx 取 ppt/slides/slideN.xml 的
 *   <a:t> run（页间 \\f，anchor pptx:slideN 与 PDF 页约定同构）；损坏/非标容器返回空串。
 * - 其余类型：空串（标题块仍可检索）。visual embedding 选型见回传（未启动）。
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
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
/** OOXML 单部件文本字符上限（docx document.xml / pptx 单 slide）。 */
const OOXML_PART_CHAR_LIMIT = 60_000
const PPTX_SLIDE_LIMIT = 200

/**
 * B6 P1-A：OOXML（docx/pptx）静态正文提取。
 * fflate 解 zip 容器（pdfjs-dist 内部同款解压库）→ 解析对应 XML 部件的文本 run：
 * - docx：word/document.xml 的 <w:t>…</w:t>，</w:p> 段落边界 → 段落间 \n（anchor docx:pN）；
 * - pptx：ppt/slides/slide<N>.xml 的 <a:t>…</a:t>，slide 间 \f（anchor pptx:slideN）。
 * 损坏/非标容器 → 空串（诚实缺席，标题块仍可检索）。
 */
export async function extractOoxmlText(observedPath: string, kind: 'docx' | 'pptx'): Promise<string> {
  const { unzipSync, strFromU8 } = await import('fflate')
  const bytes = new Uint8Array(await readFile(observedPath))
  const entries = unzipSync(bytes, { filter: (file) => kind === 'docx'
    ? file.name === 'word/document.xml'
    : file.name.startsWith('ppt/slides/slide') && file.name.endsWith('.xml') })
  if (kind === 'docx') {
    const data = entries['word/document.xml']
    if (data === undefined) return ''
    const xml = strFromU8(data).slice(0, OOXML_PART_CHAR_LIMIT * 4)
    // </w:p> = 段落边界 → \n；<w:t> 内为文本 run。
    return xml
      .replace(/<w:p[ >]/g, '\n<w:p ')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n')
      .trim()
      .slice(0, OOXML_PART_CHAR_LIMIT)
  }
  const slideNumbers = Object.keys(entries)
    .map((name) => Number(/^ppt\/slides\/slide(\d+)\.xml$/.exec(name)?.[1] ?? Number.NaN))
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => a - b)
    .slice(0, PPTX_SLIDE_LIMIT)
  const slides: string[] = []
  for (const slideNumber of slideNumbers) {
    const xml = strFromU8(entries[`ppt/slides/slide${slideNumber}.xml`]!).slice(0, OOXML_PART_CHAR_LIMIT * 4)
    const text = xml
      .replace(/<\/a:p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n')
      .trim()
      .slice(0, OOXML_PART_CHAR_LIMIT)
    slides.push(text)
  }
  return slides.join('\f')
}

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
  if (mimeType === DOCX_MIME || mimeType === PPTX_MIME) {
    try {
      return await extractOoxmlText(fileRecord.observedPath, mimeType === DOCX_MIME ? 'docx' : 'pptx')
    } catch {
      return '' // 损坏/非标容器：标题块仍可检索，正文诚实缺席
    }
  }
  if (mimeType.startsWith(IMAGE_MIME_PREFIX) && input.ocrEvidence !== undefined
    && input.projectId !== undefined && input.artifactId !== undefined) {
    return input.ocrEvidence(input.projectId, input.artifactId) ?? ''
  }
  return ''
}
