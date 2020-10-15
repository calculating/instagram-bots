const fs = require('fs').promises
const readline = require('readline')

const WebSocket = require('ws')

let database = {
  username: '',
  password: '',
  cookies: {
    async get() {
      try {
        return JSON.parse(await fs.readFile(__dirname + '/data/cookies.json'))
      } catch (err) {
        return []
      }
    },
    async set(array) {
      if (!Array.isArray(array))
        throw new Error('Cookies must be an array')
      try {
        await fs.mkdir(__dirname + '/data')
      } catch (err) {
        if (err.code !== 'EEXIST')
          throw err
      }
      await fs.writeFile(__dirname + '/data/cookies.json', JSON.stringify(array))
    },
  },
}

let log = (...args) => {
  rl.output.write('\x1b[2K\r')
  console.log(...args)
  rl._refreshLine()
}

let wss = new WebSocket.Server({ port: 6000 })

let ws = null
let i = -1

wss.on('connection', newWs => {
  log('New connection')
  if (ws) ws.close()

  ws = newWs
  i = -1
  ws.on('message', data => {
    let message
    try {
      message = JSON.parse(data)
    } catch (e) {}
    if (message == null || typeof message !== 'object') {
      console.warn('Invalid packet received', data)
      return
    }
    log(message)

    if (message.t === 'ack') {
      if (message.i !== i)
        log(`Mismatch in acknowledgement index: expecting ${i} but received ${message.i}`)
      rl.prompt()
    }
  })
  ws.on('close', code => {
    log('Connection closed', code)
    ws = null
  })
})

let rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> ',
})

rl.prompt()

rl.on('line', line => {
  let [all, cmd, argsString] = line.match(/^([^\s]*)(?:\s+([^]*))?$/)
  let args = []
  if (argsString) {
    try {
      args = JSON.parse(`[${argsString}]`)
    } catch (err) {
      log('Invalid arguments')
      return
    }
  }
  if (!ws) {
    log('No connected client')
  } else {
    i++
    ws.send(JSON.stringify({ i, t: 'cmd', cmd, args }))
  }
})

rl.on('close', () => {
  console.log()
  process.exit(0)
})
