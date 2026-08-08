import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

const base = (props: P) => ({
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
})

export const ImageGlyph = (p: P) => <svg {...base(p)}><rect x="1.8" y="3" width="12.4" height="10" rx="1.6"/><path d="M1.8 10.4 5.3 7.6l3 2.3 2.3-1.8 3.6 2.7"/><circle cx="5.6" cy="6" r="1"/></svg>
export const DocumentGlyph = (p: P) => <svg {...base(p)}><path d="M3.4 1.8h5.3L12.6 5.7v8.5H3.4z"/><path d="M8.6 1.8v4h4M5.4 8.5h5.2M5.4 10.7h4"/></svg>
export const LinkGlyph = (p: P) => <svg {...base(p)}><path d="M6.3 9.7 4.9 11a2.3 2.3 0 0 1-3.2-3.2l2-2a2.3 2.3 0 0 1 3.2 0"/><path d="m9.7 6.3 1.4-1.4a2.3 2.3 0 1 1 3.2 3.2l-2 2a2.3 2.3 0 0 1-3.2 0"/><path d="m5.7 10.3 4.6-4.6"/></svg>
export const FeedbackGlyph = (p: P) => <svg {...base(p)}><path d="M2.2 4.2a1.8 1.8 0 0 1 1.8-1.8h8a1.8 1.8 0 0 1 1.8 1.8v5a1.8 1.8 0 0 1-1.8 1.8H6.4L3.2 13.6V11H4a1.8 1.8 0 0 1-1.8-1.8z"/></svg>
export const SessionGlyph = (p: P) => <svg {...base(p)}><circle cx="3.4" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="12.6" cy="8" r="1.5"/><path d="M4.9 8h1.6M9.5 8h1.6"/></svg>
export const RunGlyph = (p: P) => <svg {...base(p)}><rect x="2.2" y="2.2" width="11.6" height="11.6" rx="2.4"/><path d="M6.6 5.9 10.4 8l-3.8 2.1z" fill="currentColor" stroke="none"/></svg>
export const DecisionGlyph = (p: P) => <svg {...base(p)}><path d="m8 2.2 5.2 5.8L8 13.8 2.8 8z"/><path d="m5.8 8 1.4 1.4 3-3"/></svg>
export const CollectionGlyph = (p: P) => <svg {...base(p)}><rect x="2" y="3" width="12" height="10" rx="2"/><path d="M4.4 6.2h7.2M4.4 8h5.2M4.4 9.8h6.1"/></svg>
export const NoteGlyph = (p: P) => <svg {...base(p)}><path d="M3 2.3h10v9.1L10.4 14H3z"/><path d="M10.4 11.4V14M5.2 5.4h5.6M5.2 7.5h4.3"/></svg>
export const AudioGlyph = (p: P) => <svg {...base(p)}><path d="M5.8 5.2H3.3v5.6h2.5l3.5 2.3V2.9z"/><path d="M11.2 5.2c1.5 1.5 1.5 4.1 0 5.6M12.8 3.7c2.4 2.4 2.4 6.2 0 8.6"/></svg>
export const VideoGlyph = (p: P) => <svg {...base(p)}><rect x="2" y="3" width="9" height="10" rx="1.8"/><path d="m11 6 3-1.7v7.4L11 10z"/></svg>
export const ArchiveGlyph = (p: P) => <svg {...base(p)}><path d="M2.5 4.5h11v8.2H2.5zM2 2.2h12v2.3H2z"/><path d="M6.2 7h3.6"/></svg>
export const ArrangeGlyph = (p: P) => <svg {...base(p)}><rect x="2.2" y="2.2" width="5" height="5" rx="1.2"/><rect x="8.8" y="2.2" width="5" height="5" rx="1.2"/><rect x="2.2" y="8.8" width="5" height="5" rx="1.2"/><rect x="8.8" y="8.8" width="5" height="5" rx="1.2"/></svg>
export const ContextGlyph = (p: P) => <svg {...base(p)}><circle cx="8" cy="8" r="2"/><circle cx="3" cy="3.4" r="1.4"/><circle cx="13" cy="3.4" r="1.4"/><circle cx="13" cy="12.6" r="1.4"/><path d="M4.1 4.5 6.6 6.7M11.9 4.5 9.4 6.7M11.9 11.5 9.5 9.4"/></svg>
export const WorkGlyph = (p: P) => <svg {...base(p)}><path d="M2.4 12.4V9.2M6.1 12.4V4.6M9.9 12.4V7M13.6 12.4V3"/></svg>
export const WorkflowGlyph = (p: P) => <svg {...base(p)}><rect x="1.8" y="2.5" width="4.1" height="3.2" rx="1"/><rect x="10.1" y="5.9" width="4.1" height="3.2" rx="1"/><rect x="1.8" y="10.3" width="4.1" height="3.2" rx="1"/><path d="M5.9 4.1h1.7a2 2 0 0 1 2 2v1.4h.5M5.9 11.9h1.7a2 2 0 0 0 2-2V8.7h.5"/></svg>
export const DeliverGlyph = (p: P) => <svg {...base(p)}><path d="M8 1.9 14 5v6l-6 3.1L2 11V5z"/><path d="M2 5l6 3.1L14 5M8 8.1v6"/></svg>
export const RootGlyph = (p: P) => <svg {...base(p)}><rect x="2.2" y="2.8" width="11.6" height="10.4" rx="1.8"/><path d="M2.2 6.2h11.6"/></svg>
export const BenchGlyph = (p: P) => <svg {...base(p)}><path d="M2 6.4h12M3.6 6.4v6.2M12.4 6.4v6.2M2.8 6.4 4.6 3.4h6.8l1.8 3"/></svg>
