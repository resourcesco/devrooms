import { PureComponent } from 'react'
import runCommand from '../command-runner'
import parse from '../command-runner/parser'
import Message from './messages/message'
import { store } from '../store'
import ChatInput from './chat-input'
import insertTextAtCursor from 'insert-text-at-cursor'

class Chat extends PureComponent {
  state = {
    commandIds: [],
    commands: {},
    text: '',
    lastCommandId: null,
  }

  constructor(props) {
    super(props)
    this.scrollRef = React.createRef()
    this.textareaRef = React.createRef()
  }

  setCommandLoading(c, loading) {
    return {...c, messages: c.messages.map(m => this.setLoading(m, loading))}
  }

  setLoading(m, loading) {
    return m.type === 'input' ? {...m, loading} : m
  }

  async componentDidMount() {
    const loadMessages = async () => {
      await store.load()
      const commands = { ...store.commands }
      for (let key of Object.keys(commands)) {
        commands[key] = this.setCommandLoading(commands[key], false)
      }
      this.setState({
        commands,
        commandIds: store.commandIds || this.state.commandIds,
      })
      this.props.onThemeChange(store.theme)
    }
    await loadMessages()
    if (this.scrollRef.current) {
      this.scrollRef.current.scrollIntoView()
    }
  }

  componentWillUnmount() {
  }

  addMessages = newMessages => {
    let {commandIds, commands} = this.state
    let clear = false
    let loadedMessage = undefined
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
        this.setState({theme: message.theme})
        store.theme = message.theme
        store.save()
        this.props.onThemeChange(message.theme)
      } else if (message.type === 'form-status') {
        const formCommand = commands[message.formCommandId]
        if (formCommand) {
          let commandMessages = (
            formCommand.messages
            .map(m => this.setLoading(m, !!message.loading))
            .filter(({type}) => type !== 'form-status')
          )
          if (message.success) {
            commandMessages = commandMessages.filter(({type}) => type !== 'form')
          }
          const formStatusMessage = {...message, commandId: message.formCommandId}
          commands[formStatusMessage.commandId] = {
            ...formCommand,
            messages: [...commandMessages, formStatusMessage],
          }
        }
      } else {
        if (commands[message.commandId]) {
          commands[message.commandId] = {...command, messages: [...command.messages, message]}
        } else {
          commands[message.commandId] = {id: message.commandId, messages: [message]}
          commandIds.push(message.commandId)
        }
      }
      this.setState({lastCommandId: message.commandId})
    }
    if (clear) {
      commands = {}
      commandIds = []
    }
    this.setCommands([...commandIds], {...commands})
    this.scrollToBottom()
  }

  setCommands = (commandIds, commands) => {
    this.setState({commandIds, commands})
    store.commandIds = commandIds
    store.commands = commands
    store.save()
  }

  send = async () => {
    const {text} = this.state
    const parsed = parse(text)
    if (Array.isArray(parsed) && parsed.length) {
      this.setState({text: ''})
      await runCommand(text, parsed, this.addMessages)
    }
  }

  scrollToBottom = () => {
    if (this.scrollRef.current) {
      this.scrollRef.current.scrollIntoView()
    }
  }

  handleTextChange = ({target}) => {
    this.setState({text: target.value})
  }

  handlePickId = id => {
    const el = this.textareaRef.current
    insertTextAtCursor(el, `${id}`)
    el.focus()
  }

  handleSubmitForm = async ({commandId, formData, message}) => {
    await runCommand(message, parse(message), this.addMessages, {formData, formCommandId: commandId})
  }

  render() {
    const { onFocusChange, theme } = this.props
    const { text, commandIds, commands, lastCommandId } = this.state
    const scrollRef = this.scrollRef
    const messages = []
    for (let commandId of commandIds) {
      const command = commands[commandId]
      for (let message of command ? command.messages : []) {
        messages.push(message)
      }
    }

    return (
      <div className="chat">
        <div className="messages-pane">
          <div className="messages-scroll">
            <div className="messages">
              {
                messages.filter(m => typeof m === 'object' && !!m).map((message, i) => (
                  <div
                    className={`chat-message ${message.type === 'input' ? 'input-message' : 'output-message'}`}
                    key={i}
                  >
                    <Message
                      key={i}
                      onLoad={this.scrollToBottom}
                      theme={theme}
                      onPickId={this.handlePickId}
                      onSubmitForm={this.handleSubmitForm}
                      isNew={message.commandId === lastCommandId}
                      {...message}
                    />
                  </div>
                ))
              }
              <div className="the-end" ref={scrollRef}></div>
            </div>
          </div>
        </div>
        <ChatInput
          textareaRef={this.textareaRef}
          text={text}
          onTextChange={this.handleTextChange}
          onFocusChange={onFocusChange}
          onSend={this.send}
        />
        <style jsx>{`
          .chat {
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            flex-grow: 1;
          }

          .chat-message {
            padding: 3px 5px;
            font-size: 20px;
          }

          .messages-pane {
            flex-grow: 1;
            display: flex;
            position: relative;
          }

          .messages-scroll {
            flex: 1;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: auto;
          }

          .current-page-docs {
            color: green;
            min-height: 300px;
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

export default Chat
