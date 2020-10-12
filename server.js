const fs = require('fs').promises

const WebSocket = require('WebSocket')

let wss = new WebSocket.Server({ port: 6000 })

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

wss.on('connection', ws => {
  ws.on('message', message => {
    // console.log(message)
  })

  // ws.send(data)
})
