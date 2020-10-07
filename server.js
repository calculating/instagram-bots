const fs = require('fs').promises

const WebSocket = require('WebSocket')

let wss = new WebSocket.Server({ port: 8080 })

wss.on('connection', ws => {
  ws.on('message', message => {
    // console.log(message)
  })

  // ws.send(data)
})
