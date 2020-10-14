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
wss.on('connection', newWs => {
  log('New connection')
  if (ws) ws.close()

  ws = newWs
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
  if (!ws) {
    log('No connected client')
  } else {
    ws.send(JSON.stringify({ cmd: line }))
  }
  rl.prompt()
})

rl.on('close', () => {
  console.log()
  process.exit(0)
})
