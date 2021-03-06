import produce, { original } from 'immer'
import { defaultPrefix } from '../constants'
import {
  getDraftUpdate,
  getDraftStateUpdate,
  draftValue,
  draftState,
  spliceArrayKeysInObject,
  getStateKey,
  getState,
  getNewKey,
} from '../util'

function insertInPlace(parent, key, position, newKey, newValue) {
  const keys = Object.keys(parent)
  const keysToMove = keys.slice(
    keys.indexOf(key) + (position === 'above' ? 0 : 1)
  )
  const removed = {}
  for (const key of keysToMove) {
    removed[key] = parent[key]
    delete parent[key]
  }
  parent[newKey] = newValue
  for (const key of keysToMove) {
    parent[key] = removed[key]
  }
}

export default function insert(treeData, treeUpdate) {
  return produce(treeData, draft => {
    const { position, path } = treeUpdate
    let newKey, parentState, stateKey, newStateKey

    const [parent, key] = ['above', 'below'].includes(position)
      ? getDraftUpdate(draft, path)
      : [draftValue(draft, path), null]

    const valueGiven = 'value' in treeUpdate
    let newValue = valueGiven ? treeUpdate.value : null

    let newState = valueGiven ? treeUpdate.state : undefined

    let prefix = defaultPrefix
    if (
      valueGiven &&
      !Array.isArray(parent) &&
      Object.keys(newValue).length === 1
    ) {
      prefix = Object.keys(newValue)[0]
      newValue = newValue[prefix]
      newState = newState[getStateKey(prefix)]
    }

    if (['above', 'below'].includes(position)) {
      const [_parentState, _stateKey] = getDraftStateUpdate(draft, path)
      parentState = _parentState
      stateKey = _stateKey
      if (Array.isArray(parent)) {
        newKey = position === 'above' ? Number(key) : Number(key) + 1
      } else {
        newKey = getNewKey(parent, prefix)
      }
    } else {
      parentState = draftState(draft, path)
      if (Array.isArray(parent)) {
        newKey = position === 'append' ? parent.length : 0
      } else {
        newKey = getNewKey(parent, prefix)
      }
    }
    newStateKey = getStateKey(newKey)

    if (Array.isArray(parent)) {
      const originalLength = parent.length
      parent.splice(Number(newKey), 0, newValue)
      spliceArrayKeysInObject(
        parentState,
        originalLength,
        Number(newKey),
        0,
        getState(newState)
      )
    } else {
      if (['above', 'below'].includes(position)) {
        insertInPlace(parent, key, position, newKey, newValue)
      } else {
        if (position === 'append' || Object.keys(parent).length === 0) {
          parent[newKey] = newValue
        } else {
          insertInPlace(
            parent,
            Object.keys(parent)[0],
            'above',
            newKey,
            newValue
          )
        }
      }
      parentState[newStateKey] = getState(newState)
    }

    if (['append', 'prepend'].includes(position)) {
      parentState._expanded = true
    }
    if (!treeUpdate.paste) {
      if (Array.isArray(parent)) {
        parentState[newStateKey]._editing = true
      } else {
        parentState[newStateKey]._editingName = 'new'
        parentState[newStateKey]._editing = 'new'
      }
    }
  })
}
