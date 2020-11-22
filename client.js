const fs = require('fs').promises
const https = require('https')
const path = require('path')

const WebSocket = require('ws')

const puppeteer = require('puppeteer-extra')

const puppeteerStealth = require('puppeteer-extra-plugin-stealth')()
puppeteerStealth.enabledEvasions.delete('user-agent-override')
puppeteer.use(puppeteerStealth)

puppeteer.use(require('puppeteer-extra-plugin-stealth/evasions/user-agent-override')({
  userAgent: puppeteer.pptr.devices['Pixel 2'].userAgent.replace(/Chrome\/[^ ]+/, 'Chrome/85.0.4182.0'),
  locale: 'en-US,en;q=0.9',
  platform: 'Linux aarch64',
}))

const PUPPETEER_DEBUG = false

if (PUPPETEER_DEBUG)
  puppeteer.use(require('puppeteer-extra-plugin-repl')())

const Connection = require('./connection')
const config = require('./client-config')
const { sleep, random, delay, downloadFile } = require('./shared')

let database = {
  username: config.username,
  password: config.password,
  server: config.server,
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

const Puppet = class {
  constructor() {
    this.browser = null
    this.context = null
    this.page = null

    this.cookies = {
      loaded: false,
      interval: null,
    }
    this.status = null
  }

  // basic browser/session initiation functions
  async launch(headless = true) {
    if (this.browser)
      await this.close()

    this.browser = await puppeteer.launch({
      headless,
      defaultViewport: puppeteer.pptr.devices['Pixel 2'].viewport,
      args: ['--window-size=500,875'],
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
    })

    console.log('Opening Instagram')

    this.context = await this.browser.createIncognitoBrowserContext()
    this.page = await this.context.newPage()
  }

  async load() {
    clearInterval(this.cookies.interval)

    // TODO: better database system?
    await this.page.setCookie(...await database.cookies.get())

    this.cookies.loaded = true
    this.cookies.interval = setInterval(async () => {
      await database.cookies.set(await this.page.cookies())
    }, 60e3)

    this.page.on('request', req => {
      if (req.isNavigationRequest() && req.frame() === this.page.mainFrame() && !/^https:\/\/www.instagram.com($|\/)/i.test(req.url())) {
        req.abort('blockedbyclient')
      } else {
        req.continue()
      }
    })

    await this.page.setRequestInterception(true)
    await this.page.goto('https://www.instagram.com/')
    await delay('network')
  }

  async close() {
    clearInterval(this.cookies.interval)

    if (this.page) {
      if (this.cookies.loaded)
        await database.cookies.set(await this.page.cookies())
      await this.browser.close()
    }

    this.browser = null
    this.context = null
    this.page = null

    this.cookies.loaded = false
    this.cookies.interval = null
    this.status = null
  }

  // xPath and base interaction functions
  async select(xPathExpression, { required = true, first = false, all = false, source = this.page } = {}) {
    let elements = await source.$x(xPathExpression)
    if (all)
      return elements
    if (elements.length > 1 && !first)
      throw new Error(`Multiple elements found for XPath expression '${xPathExpression}'`)
    if (elements.length === 0 && required)
      throw new Error(`No element found for XPath expression '${xPathExpression}'`)
    return elements[0] || null
  }

  async tap(xPathExpression, delayType = false, config = {}) {
    config.all = false
    let element = await this.select(xPathExpression, config)
    if (element) {
      await element.tap()
      if (delayType) await delay(delayType)
    }
    return !!element
  }

  async type(xPathExpression, content, delayType = null, config = {}) {
    config.all = false
    let element = await this.select(xPathExpression, config)
    if (element) {
      await element.type(content, { delay: random(75, 100) })
      if (delayType) await delay(delayType)
    }
    return !!element
  }

  async scrollTo(xPathExpression, deltaY, targetY, config = {}) {
    config.all = false
    while (true) {
      let element = await this.select(xPathExpression, config)

      let { y } = await element.boundingBox()
      if (y <= targetY) {
        await element.tap()
        await delay('network')
        break
      }

      await this.page.mouse.wheel({ deltaY })
      await delay('network')
    }
  }

  async fetchData(xPathExpression, type = 'text', config = {}) {
    config.all = false
    let element = await this.select(xPathExpression, config)
    if (!element) return null

    if (type === 'src')
      return element.evaluate(node => node.getAttribute('src'))
    if (type === 'text')
      return element.evaluate(node => node.innerText)
    return null
  }

  // main actions
  async login(username = database.username, password = database.password) {
    if (!await this.tap('//button[contains(., "Log In")]', 'fast', { required: false })) return
    await this.type('//input[@name="username"]', username, 'veryFast')
    await this.type('//input[@name="password"]', password, 'veryFast')
    await this.tap('//button[contains(., "Log In")]', 'long')
    await this.tap('//button[contains(., "Save Info")]', 'network', { required: false })
  }

  async createPost(src, caption) {
    let localPath = path.join(__dirname, 'data', `tmp-file${path.extname(src)}`)
    await downloadFile(src, localPath)

    let fileChooserPromise = this.page.waitForFileChooser()

    await this.tap('//*[@aria-label="New Post"]', 'network')

    let fileChooser = await fileChooserPromise
    await fileChooser.accept([localPath])
    await delay('fast')

    await this.tap('//div/button[text()="Next"]', 'network')

    if (caption)
      await this.type('//textarea[contains(@aria-label, "Write a caption")]', caption, 'veryFast')

    await this.tap('//div/button[text()="Share"]', 'long')

    await fs.unlink(localPath)
  }

  // debug function
  async debugRepl() {
    if (PUPPETEER_DEBUG)
      await this.page.repl()
  }
}

let puppet = new Puppet()
let conn = null
let exiting = false

let startConnection = () => {
  if (exiting) return

  conn = new Connection(new WebSocket(`ws://${database.server}/`))

  conn.on('open', () => {
    console.log('Connected to server')
    conn.send('auth', config.token).then(() => console.log('Logged in to server'))
  })

  conn.handle('cmd', async ({ cmd, args }) => {
    if (cmd.startsWith('_'))
      throw new Error('Invalid command')
    if (PUPPETEER_DEBUG)
      console.log(cmd, args)
    return await puppet[cmd](...args)
  })

  conn.handle('exit', async () => {
    setTimeout(() => process.exit(0), 200)
  })

  conn.on('close', async () => {
    console.log('Disconnected from server')

    try {
      await puppet.close()
    } catch (err) {
      console.log(err)
      process.exit(1)
    }

    setTimeout(() => startConnection(), 60e3)
  })

  conn.on('error', console.error)
}

startConnection()

for (let signal of ['SIGINT', 'SIGHUP', 'SIGTERM'])
  process.on(signal, () => {
    if (exiting) return
    exiting = true

    setTimeout(() => process.exit(1), 1000)

    conn.close(1001)
  })

process.stdin.resume()
