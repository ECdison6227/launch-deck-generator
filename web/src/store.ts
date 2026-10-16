import { create } from 'zustand'
import { temporal } from 'zundo'
import { referencedMedia, type Project } from './model'

type ProjectState = { project: Project | null; setProject: (change: Project | null | ((current: Project | null) => Project | null)) => void }
let lastEdit = 0
let lastStructure = ''
const structure = (p: Project | null) => JSON.stringify(p?.scenes.map(s => [s.id, s.presetId, s.photos, s.videoId, s.posterId]))

export const useProjectStore = create<ProjectState>()(temporal(set => ({
  project: null,
  setProject: change => set(current => ({ project: typeof change === 'function' ? change(current.project) : change })),
}), {
  partialize: state => ({ project: state.project }),
  limit: 100,
  equality: (past, next) => !past.project || !next.project || (past.project.scenes === next.project.scenes && past.project.name === next.project.name && past.project.background === next.project.background && past.project.transition === next.project.transition),
  handleSet: handle => (past, replace, current) => {
    const now = performance.now(); const key = structure(current.project)
    // 连续输入合成一步，媒体、场景和版式改变必须独立保留。
    if (now - lastEdit >= 500 || key !== lastStructure || !lastEdit) handle(past, replace)
    lastEdit = now; lastStructure = key
  },
}))

export function replaceProject(project: Project) {
  const history = useProjectStore.temporal.getState()
  history.pause(); useProjectStore.getState().setProject(project); history.clear(); history.resume(); lastEdit = 0
}

export function restoreHistory(direction: 'undo' | 'redo') {
  lastEdit = 0
  useProjectStore.temporal.getState()[direction]()
  return useProjectStore.getState().project
}

/** 撤销栈还引用的素材也要保留，历史淘汰后再随下一次媒体变更回收。 */
export function historyMediaIds() {
  const history = useProjectStore.temporal.getState()
  return [...new Set([...history.pastStates, ...history.futureStates].flatMap(s => s.project ? referencedMedia(s.project) : []))]
}
