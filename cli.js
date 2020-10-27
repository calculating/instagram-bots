const readline = require('readline')

const WebSocket = require('ws')

const Connection = require('./connection')
const config = require('./client-config')

const log = (...args) => {
  rl.output.write('\x1b[2K\r')
  console.log(...args)
  rl._refreshLine()
}

const parseLine = line => {
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

const getTimeOfDay = date => ((date.getUTCHours() * 60 + date.getUTCMinutes()) * 60 + date.getUTCSeconds()) * 1000 + date.getUTCMilliseconds()

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
          let list = await conn.send('queue.get')
          log('Posts in the queue:\n' + list.map((post, i) => `[${i}] ${new Date(post.time).toLocaleString()} - ${post.url} - "${post.caption}"`).join('\n'))
          break
        case 'add':
        case 'a':
          log('`queue add` is disabled for security reasons')
          // await conn.send('queue.add', { url: args[0], caption: args[1], time: args[2] })
          break
        case 'set':
        case 's':
          if (args[1] !== 'caption' && args[1] !== 'time') {
            log('Only the caption and the time can be set')
            break
          }
          let value = args[1] === 'time' ? new Date(args[2]).getTime() : args[2]
          await conn.send('queue.set', { id: args[0], key: args[1], value })
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

    case 'postGen':
    case 'pg':
      switch (args.shift() || null) {
        case null:
          let config = await conn.send('postGen.configGet')
          console.log('Config', config)
          break
        case 'enable':
          await conn.send('postGen.configSet', { key: 'enabled', value: true })
          break
        case 'disable':
          await conn.send('postGen.configSet', { key: 'enabled', value: false })
          break
        case 'set':
        case 's':
          if (args[0] !== 'queueMax' && args[0] !== 'category' && args[0] !== 'dailyScheduledTimes') {
            log('Only the queueMax, category, and the dailyScheduledTimes can be set')
            break
          }
          let value =
            args[0] === 'queueMax' ? +args[1] :
              args[0] === 'category' ? args[1] :
                args.slice(1).map(t => +t)
          await conn.send('postGen.configSet', { key: args[0], value })
          break
        case 'reschedule':
          await conn.send('postGen.configSet', {
            key: 'dailyScheduledTimes',
            value: args.map(t => getTimeOfDay(new Date(new Date().toISOString().replace(/T.+/, 'T' + t)))),
          })
          break
        default:
          log('Invalid subcommand for queue')
          break
      }
      break

    case 'help':
      // [......][......][......][......][......][......][......][......][......][......]
      log([
        'queue list                              List the queue',
        //'queue add    <url> <caption> <time>',
        //'queue set    <id> url     <url>',
        'queue set    <id> caption <caption>     Set the caption of a post in the queue',
        'queue set    <id> time    <time>        Set the time of a post in the queue',
        'queue remove <id>                       Remove a post from the queue',
        '',
        'postGen                                 View the current post generation config',
        'postGen enable                          Enable automatic post generation',
        'postGen disable                         Disable automatic post generation',
        'postGen set queueMax <number>           Set the maximum number of posts that the',
        '                                        queue can have before generation stops',
        'postGen set category <category>         Set the category of posts to generate',
        'postGen reschedule [time] [time] ...    Set the times of day for post generation',
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


