import { isObject } from './analyze'
import { updateTree } from './state'
import { getTheme } from './themes'
import NodeView from './NodeView'

const optionDefaults = {
  bubbleMenu: true,
  dotMenu: true,
}

export default ({ onChange, onMessage, theme, options = {}, ...props }) => {
  if (typeof onMessage === 'function' && isObject(theme)) {
    return <NodeView onMessage={onMessage} theme={theme} {...props} />
  } else {
    let themeProp = theme
    let onMessageProp = onMessage
    if (typeof onMessageProp !== 'function') {
      onMessageProp = message => {
        const treeData = {
          name: props.name,
          value: props.value,
          state: props.state,
        }
        onChange(updateTree(treeData, message))
      }
    }
    return (
      <NodeView
        onMessage={onMessageProp}
        options={{ ...optionDefaults, ...options }}
        theme={getTheme(theme)}
        {...props}
      />
    )
  }
}
