import giphy from './giphy'
import github from './github'
import asana from './asana'
import openfaas from './openfaas'
import clientGateway from './client-gateway'
import docs from './docs'
import note from './note'
import clear from './clear'
import help from './help'
import roll from './roll'
import request from './request'

export default {
  help,
  docs,
  giphy,
  github,
  asana,
  openfaas,
  'client-gateway': clientGateway,
  note,
  clear,
  roll,
  request,
  'dark-mode': {
    run() {
      return {type: 'set-theme', theme: 'dark'}
    },
    help: {
      details: 'change to the dark theme'
    }
  },
  'light-mode': {
    run() {
      return {type: 'set-theme', theme: 'light'}
    },
    help: {
      details: 'change to the light theme'
    }
  },
  'sleep': {
    async run({args}) {
      const [timeoutStr, message] = args
      const timeout = Math.floor(Number.parseFloat(timeoutStr) * 1000)
      const promise = new Promise((resolve, reject) => {
        setTimeout(resolve, timeout)
      })
      await promise
      return { type: 'text', text: message || '' }
    },
    help: {
      args: ['seconds', 'message'],
      details: 'Sleep for a specified number of seconds and then send a message'
    }
  }
}
