const readline = require('readline')

const WebSocket = require('ws')

const Connection = require('./connection')
const config = require('./client-config')

let log = (...args) => {
  rl.output.write('\x1b[2K\r')
  console.log(...args)
  rl._refreshLine()
}

let parseLine = line => {
  let args = []
  for (let arg of (line.trim().match(/(?:[^\s"']+|"([^"\\]|\\[^])*"|'[^']*')+/g) || [])) {
    if (arg.startsWith('"')) {
      args.push(JSON.parse(arg))
    } else if (arg.startsWith('\'')) {
      args.push(arg.slice(1, -1))
    } else {
      args.push(arg)
    }
  }
  return args
}

let conn = new Connection(new WebSocket(`ws://${config.server}/api/alpha`))

conn.on('open', () => {
  rl.prompt()
  log('Connected')
  conn.send('auth', config.token)
})

conn.on('close', () => {
  console.log('Connection closed')
  process.exit(0)
})

conn.on('error', err => {
  console.log('Connection error')
  process.exit(0)
})

let rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> ',
})

rl.on('line', async line => {
  let args
  try {
    args = parseLine(line)
  } catch (err) {
    log('Invalid quoted string in command')
  }

  switch (args.shift()) {
    case 'queue':
    case 'q':
      switch (args.shift()) {
        case 'list':
        case 'ls':
          let list = await conn.send('queue.list')
          log('Posts in the queue:\n' + list.map((post, i) => `[${i}] ${new Date(post.time).toLocaleString()} - ${post.url} - "${post.caption}"`).join('\n'))
          break
        case 'add':
        case 'a':
          log('`queue add` is disabled for security reasons')
          // await conn.send('queue.add', { url: args[0], caption: args[1], time: args[2] })
          break
        case 'set':
          if (args[1] !== 'caption' && args[1] !== 'time') {
            log('Only the caption and the time can be set')
            break
          }
          await conn.send('queue.set', { id: args[0], key: args[1], value: args[2] })
          break
        case 'remove':
        case 'rm':
          await conn.send('queue.remove', { id: args[0] })
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
        //'queue add    [url] [caption] [time]',
        //'queue set    [id] url     [url]',
        'queue set    [id] caption [caption]',
        'queue set    [id] time    [time]',
        'queue remove [id]',
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
  conn.close(1001)
  process.exit(0)
})


