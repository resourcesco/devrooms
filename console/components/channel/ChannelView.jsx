import React, { PureComponent } from 'react'
import insertTextAtCursor from 'insert-text-at-cursor'
import { Manager } from 'react-popper'
import pick from 'lodash/pick'
import pickBy from 'lodash/pickBy'
import identity from 'lodash/identity'
import getNested from 'lodash/get'
import produce from 'immer'
import { parseCommand, updateTree, removeTemporaryState } from 'vtv'
import { getTheme } from '../../themes'
import runCommand from '../../command-runner'
import { MemoryStore, LocalStorageStore } from '../../store'
import ConsoleWorkspace from '../../services/workspace/ConsoleWorkspace'
import Message from '../messages/Message'
import ChannelInput from './ChannelInput'

class MessageList extends PureComponent {
  render() {
    const {
      commands,
      commandIds,
      lastCommandId,
      scrollRef,
      onPickId,
      onSubmitForm,
      onMessage,
      codeMirrorComponent,
      theme,
    } = this.props

    const messages = []
    for (let commandId of commandIds) {
      const command = commands[commandId]
      for (let message of command ? command.messages : []) {
        messages.push(message)
      }
    }

    return (
      <div className="messages-scroll">
        <div className="messages">
          {messages
            .filter(m => typeof m === 'object' && !!m)
            .map((message, i) => (
              <div
                className={`chat-message ${
                  message.type === 'input' ? 'input-message' : 'output-message'
                }`}
                key={i}
              >
                <Message
                  key={i}
                  theme={theme}
                  codeMirrorComponent={codeMirrorComponent}
                  onPickId={onPickId}
                  onSubmitForm={onSubmitForm}
                  onMessage={onMessage}
                  isNew={message.commandId === lastCommandId}
                  {...message}
                />
              </div>
            ))}
          <div className="the-end" ref={scrollRef}></div>
        </div>
        <style jsx>{`
          .messages-scroll {
            flex-grow: 1;
            overflow: scroll;
          }

          .messages {
            flex: 0;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
          }

          .input-message {
            color: ${theme.inputColor};
          }
        `}</style>
      </div>
    )
  }
}

class ChannelView extends PureComponent {
  constructor(props) {
    super(props)
    this.state = {
      commandIds: [],
      commands: {},
      text: '',
      lastCommandId: null,
    }
    this.scrollRef = React.createRef()
    this.textareaRef = React.createRef()
  }

  setCommandLoading(c, loading) {
    return { ...c, messages: c.messages.map(m => this.setLoading(m, loading)) }
  }

  setLoading(m, loading) {
    return m.type === 'input' ? { ...m, loading } : m
  }

  removeTemporaryCommandState(command) {
    if (command.type === 'tree') {
      return removeTemporaryState(command)
    } else {
      return command
    }
  }

  async componentDidMount() {
    const loadMessages = async () => {
      const { store } = this.props
      await store.load()
      const commands = { ...store.commands }
      for (let key of Object.keys(commands)) {
        commands[key] = this.setCommandLoading(commands[key], false)
        commands[key] = this.removeTemporaryCommandState(commands[key])
      }
      this.setState({
        commands,
        commandIds: store.commandIds || this.state.commandIds,
      })
      // this.setState({
      //   commands: {},
      //   commandIds: [],
      // })
      this.props.onThemeChange(store.theme)
    }
    await loadMessages()
    if (this.scrollRef.current) {
      this.scrollRef.current.scrollIntoView()
    }
  }

  componentWillUnmount() {}

  addMessages = messageOrArray => {
    const { store } = this.props
    let { commandIds, commands } = this.state
    let clear = false
    let loadedMessage = undefined
    let scrollToBottom = false
    const newMessages = Array.isArray(messageOrArray)
      ? messageOrArray
      : [messageOrArray]
    for (let message of newMessages) {
      const command = commands[message.commandId]
      if (message.type === 'loaded') {
        if (commands[message.commandId]) {
          commands[message.commandId] = {
            ...command,
            messages: command.messages.map(m => this.setLoading(m, false)),
          }
        }
      } else if (message.type === 'clear') {
        clear = true
      } else if (message.type === 'set-theme') {
        this.setState({ theme: message.theme })
        store.theme = message.theme
        store.save()
        this.props.onThemeChange(message.theme)
      } else if (['tree-update', 'message-command'].includes(message.type)) {
        scrollToBottom = false
        const treeCommand = commands[message.parentCommandId]
        const treeMessage = treeCommand.messages.find(
          message => message.type === 'tree'
        )
        let updates
        if (message.type === 'tree-update') {
          updates = message
        } else if (message.type === 'message-command') {
          const {
            type: __type,
            commandId: __commandId,
            ...treeUpdates
          } = message
          updates = updateTree(
            pick(treeMessage, ['name', 'value', 'state']),
            treeUpdates
          )
        }
        const updatedTreeMessage = {
          ...treeMessage,
          ...pickBy(pick(updates, ['name', 'value', 'state']), identity),
        }
        commands[message.parentCommandId] = {
          ...treeCommand,
          messages: treeCommand.messages
            .map(m => this.setLoading(m, !!message.loading))
            .map(message =>
              message.type === 'tree' ? updatedTreeMessage : message
            ),
        }
      } else if (message.type === 'form-status') {
        const formCommand = commands[message.parentCommandId]
        if (formCommand) {
          let commandMessages = formCommand.messages
            .map(m => this.setLoading(m, !!message.loading))
            .filter(({ type }) => type !== 'form-status')
          if (message.success) {
            commandMessages = commandMessages.filter(
              ({ type }) => type !== 'form'
            )
          }
          const formStatusMessage = {
            ...message,
            commandId: message.parentCommandId,
          }
          commands[formStatusMessage.commandId] = {
            ...formCommand,
            messages: [...commandMessages, formStatusMessage],
          }
        }
        scrollToBottom = true
      } else {
        let newMessage = message
        if (message.type === 'message-get') {
          const treeCommand = commands[message.parentCommandId]
          const treeMessage = treeCommand.messages.find(
            message => message.type === 'tree'
          )
          newMessage = {
            ...message,
            type: 'tree',
            name: message.path[message.path.length - 1] || 'value',
            value: getNested(treeMessage.value, message.path),
          }
        }
        if (commands[message.commandId]) {
          commands[message.commandId] = {
            ...command,
            messages: [...command.messages, newMessage],
          }
        } else {
          commands[message.commandId] = {
            id: message.commandId,
            messages: [newMessage],
          }
          commandIds.push(message.commandId)
        }
        if (message.type !== 'input') {
          scrollToBottom = true
        }
      }
      this.setState({ lastCommandId: message.commandId })
    }
    if (clear) {
      commands = {}
      commandIds = []
    }
    this.setCommands([...commandIds], { ...commands })
    if (scrollToBottom) {
      this.scrollToBottom()
    }
  }

  setCommands = (commandIds, commands) => {
    const { store } = this.props
    this.setState({ commandIds, commands })
    store.commandIds = commandIds
    store.commands = commands
    store.save()
  }

  send = async () => {
    const { channel, store } = this.props
    const { text } = this.state
    const parsed = parseCommand(text)
    if (Array.isArray(parsed) && parsed.length) {
      this.setState({ text: '' })
      await runCommand({
        message: text,
        parsed,
        onMessagesCreated: this.addMessages,
        channel,
        store,
      })
    }
  }

  scrollToBottom = () => {
    setTimeout(() => {
      if (this.scrollRef.current) {
        this.scrollRef.current.scrollIntoView()
      }
    }, 10)
  }

  handleTextChange = ({ target }) => {
    this.setState({ text: target.value })
  }

  handlePickId = id => {
    const el = this.textareaRef.current
    insertTextAtCursor(el, `${id}`)
    el.focus()
  }

  handleSubmitForm = async ({ commandId, formData, message }) => {
    const { channel, store } = this.props
    const { commands } = this.state
    const parentMessage = (
      getNested(commands, [commandId, 'messages']) || []
    ).filter(message => message.type === 'tree')[0]
    const parsed = parseCommand(message)
    await runCommand({
      message,
      parsed,
      onMessagesCreated: this.addMessages,
      formData,
      parentCommandId: commandId,
      parentMessage,
      channel,
      store,
    })
  }

  handleSelectExample = example => {
    this.setState({ text: example })
    if (this.textareaRef.current) {
      this.textareaRef.current.focus()
    }
  }

  handleAddMessage = message => {
    this.addMessages([message])
  }

  render() {
    const {
      onFocusChange,
      navComponent,
      codeMirrorComponent,
      theme,
    } = this.props
    const Nav = navComponent
    const { text, commandIds, commands, lastCommandId } = this.state
    const scrollRef = this.scrollRef

    return (
      <div className="chat">
        <div className="nav">
          {Nav && (
            <Nav onSelectExample={this.handleSelectExample} theme={theme} />
          )}
        </div>
        <MessageList
          commands={commands}
          commandIds={commandIds}
          lastCommandId={lastCommandId}
          scrollRef={scrollRef}
          onPickId={this.handlePickId}
          onSubmitForm={this.handleSubmitForm}
          onMessage={this.handleAddMessage}
          codeMirrorComponent={codeMirrorComponent}
          theme={theme}
        />
        <div className="channel-input-wrapper">
          <ChannelInput
            textareaRef={this.textareaRef}
            text={text}
            onTextChange={this.handleTextChange}
            onFocusChange={onFocusChange}
            onSend={this.send}
            theme={theme}
          />
        </div>
        <style jsx>{`
          .chat {
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            align-items: stretch;
            height: 100%;
            box-sizing: border-box;
            flex-grow: 1;
            background-color: ${theme.background};
            color: ${theme.foreground};
            font-family: ${theme.fontFamily};
            font-size: 80%;
            padding: 3px;
          }

          .chat :global(::selection) {
            color: ${theme.selectionColor};
            background: ${theme.selectionBackground};
          }
        `}</style>
      </div>
    )
  }
}

class ChannelViewWrapper extends PureComponent {
  state = {
    theme: 'dark',
    channel: null,
  }

  handleThemeChange = theme => {
    this.setState({ theme })
  }

  get store() {
    if (!this._store) {
      if (this.props.storageType === 'localStorage') {
        this._store = new LocalStorageStore()
      } else {
        this._store = new MemoryStore()
      }
    }
    return this._store
  }

  async loadChannel() {
    const workspace = ConsoleWorkspace.getWorkspace()
    const channel = await workspace.getChannel('main')
    this.setState({ channel })
  }

  get channel() {
    if (this.props.channel) {
      return this.props.channel
    } else if (this.state.channel) {
      return this.state.channel
    } else {
      this.loadChannel()
    }
  }

  render() {
    const {
      theme,
      onThemeChange,
      store,
      channel,
      storageType,
      ...props
    } = this.props
    return (
      <ChannelView
        theme={theme || getTheme(this.state.theme)}
        onThemeChange={onThemeChange || this.handleThemeChange}
        store={store || this.store}
        channel={channel || this.channel}
        {...props}
      />
    )
  }
}

export default ChannelViewWrapper