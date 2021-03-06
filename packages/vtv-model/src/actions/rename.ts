import produce from 'immer'
import {
  getStateKey,
  draftValue,
  draftState,
  renameDraftKey,
  getNewKey,
} from '../util'

export default function rename(treeData, treeUpdate) {
  return produce(treeData, draft => {
    const state = draftState(draft, treeUpdate.path)
    if (treeUpdate.editing) {
      state._editingName = treeUpdate.editing
    } else {
      delete state['_editingName']
    }
    if ('value' in treeUpdate) {
      if (treeUpdate.path.length === 0) {
        draft.name = treeUpdate.value
      } else if (
        treeUpdate.path[treeUpdate.path.length - 1] !== treeUpdate.value
      ) {
        const lastIndex = treeUpdate.path.length - 1
        const parentPath = treeUpdate.path.slice(0, lastIndex)
        const key = treeUpdate.path[lastIndex]
        const draftParentValue = draftValue(draft, parentPath)
        const newKey = getNewKey(draftParentValue, treeUpdate.value)

        renameDraftKey(draftParentValue, key, newKey)

        const draftParentState = draftState(draft, parentPath)
        draftParentState[getStateKey(newKey)] =
          draftParentState[getStateKey(key)]
        delete draftParentState[getStateKey(key)]

        if (treeData.state._showOnly && treeData.state._showOnly.length === treeUpdate.path.length) {
          const treeDataState = draftState(draft, [])
          treeDataState._showOnly[treeDataState._showOnly.length - 1] = newKey
        }
      }

      if (!state._editingName) {
        if (treeUpdate.tab) {
          // edit if tab is pressed
          state._editing = state._editing || true
        } else if (
          state._editing === 'new' &&
          (treeUpdate.tab || treeUpdate.enter)
        ) {
          state._editing = 'new'
        } else {
          delete state['_editing']
        }
      }
    } else {
      if (!state._editingName) {
        delete state['_editing']
      }
    }
  })
}
