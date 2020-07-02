import ConsoleChannel, { ChannelProps } from '../channel/ConsoleChannel'
import ConsoleError from '../ConsoleError'
import Client from '../client/Client'
import ClientFileStore from '../storage/ClientFileStore'
import { FileStore, FileStoreConstructor } from '../storage/FileStore'
import BrowserFileStore from 'api/storage/BrowserFileStore'

interface WorkspaceConfig {
  name: string
  displayName?: string
  channels: {
    [key: string]: ChannelProps
  }
}

interface WorkspaceClientConfig {
  name: string
  localPath: string
  apiBaseUrl: string
  adapter: 'fetch' | 'ipc'
  fileStoreClass?: FileStoreConstructor
}

const defaultChannels = {
  general: {
    name: 'general',
    admin: false,
  },
  admin: {
    name: 'admin',
    admin: true,
  },
}

class ConsoleWorkspace {
  clientConfig: WorkspaceClientConfig
  config?: WorkspaceConfig

  channels: any
  client: Client
  fileStore: FileStore

  static workspaces = {}

  constructor(clientConfig: WorkspaceClientConfig) {
    this.clientConfig = clientConfig

    this.channels = {}
    this.client = this.getClient()
    this.fileStore = this.getFileStore()
  }

  getClient() {
    return new Client({
      adapter: this.clientConfig.adapter,
      baseUrl: this.clientConfig.apiBaseUrl,
    })
  }

  getFileStore() {
    if (this.clientConfig.fileStoreClass) {
      return new this.clientConfig.fileStoreClass({
        path: this.clientConfig.localPath,
      })
    } else if (
      typeof window !== 'undefined' &&
      process.env.NEXT_PUBLIC_BROWSER_STORAGE === 'true'
    ) {
      return new BrowserFileStore({ path: '/' })
    } else {
      return new ClientFileStore({
        path: this.clientConfig.localPath,
        client: this.client.constrain('files'),
      })
    }
  }

  async init() {
    await this.loadConfig()
  }

  async loadConfig() {
    const resp = await this.fileStore.get({ path: 'workspace.json' })
    if (resp.ok) {
      this.config = resp.body
    } else {
      this.config = { name: this.clientConfig.name, channels: defaultChannels }
      await this.fileStore.put({ path: 'workspace.json', value: this.config })
    }
  }

  async getChannel(name) {
    if (!(name in this.channels)) {
      if (!(name in this.config.channels)) {
        throw new ConsoleError('Not found', { status: 404 })
      }
      this.channels[name] = new ConsoleChannel({
        name,
        admin: this.config.channels[name].admin,
        client: this.client.constrain(`channels/${name}`),
        fileStore: this.fileStore.constrain(`channels/${name}`),
      })
      await this.channels[name].init()
    }
    return this.channels[name]
  }

  async getClientConfig(params) {
    if (!this.config) {
      await this.loadConfig()
    }
    const clientConfig = { channels: {} }
    for (const channelName of Object.keys(this.config.channels)) {
      const channel = await this.getChannel(channelName)
      clientConfig.channels[channelName] = await channel.getClientConfig(params)
    }
    return clientConfig
  }

  static getClientConfig(): WorkspaceClientConfig {
    const useIpc = typeof window !== 'undefined' ? 'rco' in window : false
    const adapter = useIpc ? 'ipc' : 'fetch'
    const apiBaseUrl = useIpc
      ? ''
      : process.env.NEXT_PUBLIC_API_BASE ||
        new URL('/api', new URL('/', window.location.href).href).href
    return {
      adapter,
      apiBaseUrl,
      localPath: './workspace',
      name: 'workspace',
    }
  }

  static async getWorkspace(
    config?: WorkspaceClientConfig | { fileStoreClass: FileStoreConstructor }
  ) {
    const configValue = {
      ...this.getClientConfig(),
      ...config,
    }
    const { name } = configValue
    if (!(name in ConsoleWorkspace.workspaces)) {
      ConsoleWorkspace.workspaces[name] = new ConsoleWorkspace(configValue)
      await ConsoleWorkspace.workspaces[name].init()
    }
    return ConsoleWorkspace.workspaces[name]
  }
}

export default ConsoleWorkspace
