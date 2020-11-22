const readline = require('readline')

const WebSocket = require('ws')

const Connection = require('./connection')
const config = require('./client-config')

let conn = new Connection(new WebSocket(`ws://${config.server}/api/alpha`))

conn.on('open', async () => {
  await conn.send('timezone', new Date().getTimezoneOffset())
  await conn.send('auth', config.token)
  rl.prompt()
})

conn.handle('line', line => {
  rl.output.write(`\x1b[2K\r${line}\n`)
  rl._refreshLine()
})

conn.on('close', () => {
  console.log('Connection closed')
  process.exit(0)
})

conn.on('error', err => {
  console.error('Connection error', err)
  process.exit(1)
})

let rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> ',
})

rl.on('line', line => {
  conn.send('line', line).then(() => rl.prompt())
})

rl.on('close', () => {
  console.log()
  conn.close(1001)
  process.exit(0)
})
