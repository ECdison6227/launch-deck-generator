import type { Project, Scene, BackgroundKind, SlideTransition } from './model'
export interface AgentImage { name?: string; dataUrl: string }
export interface ScenePatch {
  scene: number; presetId?: string; name?: string; headings?: string[]; texts?: string[]; footnote?: string
  font?: Scene['font']; textColor?: string; textEffect?: Scene['textEffect']; photoEffect?: Scene['photoEffect']; motion?: boolean
  images?: (string | AgentImage)[]; video?: string | AgentImage
  chart?: { categories?: string[]; series?: { label?: string; values: number[]; color?: string }[] }
}
export interface AgentResult { project: Project; scene: number; addedImages: number; ignoredImages: number }
export interface FlowAgent {
  inspect: () => Project | null
  listPresets: () => unknown
  apply: (patch: ScenePatch) => Promise<AgentResult>
  addScene: (patch: Omit<ScenePatch, 'scene'>) => Promise<AgentResult>
  setBackground: (patch: { kind?: BackgroundKind; colors?: string[]; preset?: string; speed?: number; paused?: boolean }) => Promise<Project>
  setTransition: (transition: SlideTransition) => Promise<Project>
}
declare global { interface Window { flowAgent?: FlowAgent } }
