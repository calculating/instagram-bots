const readline = require('readline')

const WebSocket = require('ws')

const config = require('./client-config.json')

let log = (...args) => {
  rl.output.write('\x1b[2K\r')
  console.log(...args)
  rl._refreshLine()
}

let ws = new WebSocket(`ws://${config.server}/api/alpha`)
let i = -1

let rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> ',
})

rl.on('line', line => {
  let args = []
  for (let arg of (line.trim().match(/(?:[^\s"']+|"([^"\\]|\\[^])*"|'[^']*')+/g) || [])) {
    if (arg.startsWith('"')) {
      try {
        args.push(JSON.parse(arg))
      } catch (e) {
        log('Invalid quoted string in command')
        rl.prompt()
        return
      }
    } else if (arg.startsWith('\'')) {
      args.push(arg.slice(1, -1))
    } else {
      args.push(arg)
    }
  }

  switch (args.shift()) {
    case 'queue':
    case 'q':
      switch (args.shift()) {
        case 'list':
          ws.send(JSON.stringify({ i, t: 'queue.list' }))
          break
        case 'add':
          log('`queue add` is disabled for security reasons')
          break
        case 'set':
          if (args[1] !== 'caption' && args[1] !== 'time') {
            log('Only the caption and the time can be set')
            rl.prompt()
            return
          }
          ws.send(JSON.stringify({ i, t: 'queue.set', id: args[0], key: args[1], value: args[2] }))
          break
        case 'delete':
          ws.send(JSON.stringify({ i, t: 'queue.delete', id: args[0] }))
          break
        default:
          log('Invalid subcommand for queue')
          break
      }
      break

    case 'postgen':
      break

    case 'help':
      log([
        'queue list',
        'queue set    [id] caption [caption]',
        'queue set    [id] time    [time]',
        'queue delete [id]',
        '',
        'Note: Arguments containing spaces or quotation marks should be put in quotes.',
      ].join('\n'))
      break

    default:
      log('Invalid command')
      break
  }
  rl.prompt()
})

rl.on('close', () => {
  console.log()
  ws.close(1001)
  process.exit(0)
})

ws.on('open', () => {
  rl.prompt()
  log('Connected')
  ws.send(JSON.stringify({ t: 'auth', token: config.token, mode: 'api' }))
})

ws.on('message', data => {
  let message
  try {
    message = JSON.parse(data)
  } catch (e) {}
  if (message == null || typeof message !== 'object') {
    console.warn('Invalid packet received', data)
    return
  }

  if (message.t === 'queue.list') {
    log('Posts in the queue:\n' + message.res.map((post, i) => `[${i}] ${post.url} - "${post.caption}" @ ${new Date(post.time).toLocaleString()}`).join('\n'))
  }
})