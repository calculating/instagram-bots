const EventEmitter = require('events')

const Connection = class extends EventEmitter {
  constructor(ws) {
    super()

    this.ws = ws
    this.wsCallbacks = {}
    this.i = 0
    this.eventHandlers = {}
    this.pongInterval = setInterval(() => ws.pong(), 3e3)
    this.dcTimeout = setTimeout(() => ws.terminate(), 3e3 + 1.5e3)

    ws.on('open', () => this.emit('open'))

    ws.on('pong', () => {
      clearInterval(this.dcTimeout)
      this.dcTimeout = setTimeout(() => ws.terminate(), 3e3 + 1.5e3)
    })

    ws.on('message', async message => {
      if (typeof message !== 'string') {
        ws.close(1003)
        return
      }
      let packet = null
      try {
        packet = JSON.parse(message)
      } catch (e) {}
      if (packet == null || typeof packet !== 'object') {
        ws.close(1008)
        return
      }

      if (packet.a != null && this.wsCallbacks[packet.a]) {
        if (packet.e != null)
          this.wsCallbacks[packet.a].reject(new Error(packet.e))
        else
          this.wsCallbacks[packet.a].resolve(packet.d)
        delete this.wsCallbacks[packet.a]
      } else if (packet.t != null && this.eventHandlers[packet.t]) {
        let res = null
        let ok = true
        try {
          res = await this.eventHandlers[packet.t](packet.d)
        } catch (err) {
          ok = false
          res = err.message
        }
        if (ok)
          ws.send(JSON.stringify({ a: packet.i, d: res }))
        else
          ws.send(JSON.stringify({ a: packet.i, e: res }))
      } else if (packet.t != null) {
        ws.send(JSON.stringify({ a: packet.i, e: `No event handler for type ${packet.t}` }))
      }
    })

    ws.on('close', code => {
      clearInterval(this.pongInterval)
      clearInterval(this.dcTimeout)
      this.quit(new Error(`Socket closed with code ${code}`))
      this.emit('close', code)
    })

    ws.on('error', err => {
      this.quit(err)
      this.emit('error', err)
    })
  }

  quit(err) {
    for (let [i, { reject }] of Object.entries(this.wsCallbacks)) {
      reject(err)
      delete this.wsCallbacks[i]
    }
  }

  handle(type, listener) {
    if (this.eventHandlers[type])
      throw new Error(`Event handler for type ${type} already exists`)
    this.eventHandlers[type] = listener
  }

  send(type, data = null) {
    let i = this.i++
    return new Promise((resolve, reject) => {
      this.wsCallbacks[i] = { resolve, reject }
      setTimeout(() => reject(new Error('Timed out')), 60e3)
      this.ws.send(JSON.stringify({ i, t: type, d: data }))
    })
  }

  close(code) {
    this.ws.close(code)
  }
}

module.exports = Connection