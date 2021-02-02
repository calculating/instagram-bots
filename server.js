const fs = require('fs').promises
const https = require('https')
const readline = require('readline')
const url = require('url')

const WebSocket = require('ws')

const Connection = require('./connection')
const { sleep, random, delay } = require('./shared')

const redditPostGen = require('./redditPostGen')

const getTimeOfDay = date => ((date.getUTCHours() * 60 + date.getUTCMinutes()) * 60 + date.getUTCSeconds()) * 1000 + date.getUTCMilliseconds()
const subtractTimeOfDay = (a, b) => ((a - b + 86400e3) % 86400e3) || 86400e3


// { accounts: {}, allPastPosts: [] }
let database = {
  serverData: {
    cache: null,
    canSave: false,
    async get() {
      if (this.cache) return this.cache
      this.cache = fs.readFile(__dirname + '/data/serverData.json').then(data => JSON.parse(data)).catch(() => null)
      this.canSave = true
      return this.cache
    },
    async save() {
      if (!this.canSave) return
      this.canSave = false
      try {
        await fs.mkdir(__dirname + '/data')
      } catch (err) {
        if (err.code !== 'EEXIST')
          throw err
      }
      await fs.writeFile(__dirname + '/data/serverData.json', JSON.stringify(await this.get()))
      this.canSave = true
    },
  },
}

const Puppet = class {
  constructor(ws) {
    this.token = null
    this.ready = false
    this.conn = new Connection(ws)
    this.conn.handle('auth', async token => {
      let serverData = await database.serverData.get()
      if (!serverData.accounts.hasOwnProperty(token)) throw new Error('Account not found')
      this.token = token
      let account = serverData.accounts[token]
      await this.launch(account.config.headless)
      await this.load()
      await this.login()
      this.ready = true
    })
  }

  // WebSocket functions
  cmd(cmd, ...args) {
    return this.conn.send('cmd', { cmd, args })
  }

  // basic browser/session initiation functions
  async launch(headless = true) {
    await this.cmd('launch', headless)
  }

  async load() {
    await this.cmd('load')
  }

  async close() {
    await this.cmd('close')
  }

  // xPath and base interaction functions
  async tap(xPathExpression, delayType = false, config = {}) {
    config.all = false
    let res = await this.cmd('tap', xPathExpression, false, config)
    if (res && delayType) await delay(delayType)
    return res
  }

  async type(xPathExpression, content, delayType = null, config = {}) {
    config.all = false
    let res = await this.cmd('type', xPathExpression, content, false, config)
    if (res && delayType) await delay(delayType)
    return res
  }

  async scrollTo(xPathExpression, deltaY, targetY, config = {}) {
    config.all = false
    await this.cmd('scrollTo', xPathExpression, deltaY, targetY, config)
  }

  async fetchData(xPathExpression, type = 'text', config = {}) {
    config.all = false
    return this.cmd('fetchData', xPathExpression, type, config)
  }

  // main actions
  async login() {
    this.cmd('login')
  }

  async eliminatePopUps() {
    await this.tap('//*[@role="dialog"]//div[div/h2[contains(., "Home screen")]]/div/button[contains(., "Cancel")]', 'fast', { required: false })
    await this.tap('//*[@role="dialog"]//div[div/h2[contains(., "Turn on Notifications")]]/div/button[contains(., "Not Now")]', 'fast', { required: false })
    await this.tap('//div[div/button[contains(., "Use the App")]]/div/button[contains(., "Not Now") or //*[@aria-label="Close"]]', 'fast', { required: false })
  }

  async backButton() {
    await this.tap('//header//*[@aria-label="Back"]', 'network')
  }

  async postComment(content) {
    await this.type('//form/textarea[contains(@aria-label, "Add a comment")]', content, 'fast')
    await this.tap('//form/button[text()="Post"]', 'network')
  }

  async postDelete() {
    await this.tap('//*[@aria-label="More options"]', 'fast')
    await this.tap('//div/button[text()="Delete"]', 'fast')
    await this.tap('//div/button[text()="Delete"]', 'network')
  }

  async postGetMediaSrc() {
    return this.fetchData('//article/div/div[@role="button"]//img | //article/div/div//*[img]/video', 'src')
  }

  async postGetCaption() {
    await this.tap('//article/div/div/div[position()=1]/div[position()=1]/div[position()=1][a[position()=1]]/span/span/button[text()="more"]', null, { required: false })

    return this.fetchData('//article/div/div/div[position()=1]/div[position()=1]/div[position()=1][a[position()=1]]/span', 'text', { required: false })
  }

  async goToSelfProfile() {
    await this.tap('//div[position()=5]/a/span/img', 'network')
  }

  async goToFollowersFromProfile() {
    await this.tap('//ul/li[position()=2]/a[contains(., "followers")]', 'network')
  }

  async goToFollowingFromProfile() {
    await this.tap('//ul/li[position()=3]/a[contains(., "following")]', 'network')
  }

  async unfollowFirstAtFollowing() {
    if (await this.tap('//div/button[text()="Following"]', 'fast', { required: false }))
      await this.tap('//*[@role="dialog"]//div/button[text()="Unfollow"]', 'network')
  }

  async goToOldestPostFromProfile() {
    await this.scrollTo('(//article/div[position()=1]/div/div[position()=last()]/div/a)[last()]', 400, 600)
    await this.tap('(//article/div[position()=1]/div/div[position()=last()]/div/a)[last()]', 'network')
  }

  async followAtProfile() {
    await this.tap('//span/button[text()="Follow" or text()="Follow Back"]', 'network', { required: false })
  }

  async createPost(path, caption, expand = false) {
    return this.cmd('createPost', path, caption, expand)
  }

  async cyclePost() {
    await this.goToSelfProfile()
    await this.goToOldestPostFromProfile()

    let src = await this.postGetMediaSrc()
    let caption = await this.postGetCaption()

    await this.postDelete()
    await this.createPost(src, caption)
  }

  async unfollowAll() {
    await this.goToSelfProfile()
    await this.goToFollowingFromProfile()
    while (true) {
      await this.unfollowFirstAtFollowing()
      await sleep(random(45 * 60e3, 60 * 60e3))
    }
  }

  /*async browseHomepage() {
    // TODO: better way to determine if a post should be liked
    let shouldLikePost = username => {
      return /^[a-z]{6,16}$/.test(username)
    }

    let lastUsername = null
    while (true) {
      let posts = await this.page.$x('//article[@role="presentation"][div/section//button//*[@aria-label="Like"]]')
      let post = null
      let likeButton = null
      let commentButton = null
      for (let currentPost of posts) {
        let [currentLikeButton] = await currentPost.$x('div/section//button//*[@aria-label="Like"]')
        let [currentCommentButton] = await currentPost.$x('div/section//button//*[@aria-label="Comment"]')
        let { y } = await currentLikeButton.boundingBox()
        if (y > 600) break
        post = currentPost
        likeButton = currentLikeButton
        commentButton = currentCommentButton
      }

      if (post) {
        let [usernameLink] = await post.$x('header/div/div/div/a')
        let username = await usernameLink.evaluate(node => node.innerHTML)
        console.log(`Found post by ${username}`)

        if (lastUsername !== username && shouldLikePost(username)) {
          console.log('Post liked')
          lastUsername = username
          await likeButton.tap()
          await delay('network')

          if (Math.random() < 0.5) {
            await commentButton.tap()
            await delay('network')

            await this.postComment('yes')

            await this.backButton()
            await delay('network')
          }
        }
      }

      await this.page.mouse.wheel({ deltaY: random(300, 500) })
      await delay('network')
    }
  }*/
}

const createApiConnection = ws => {
  let conn = new Connection(ws)

  let token = null // TODO: this is kinda bad?
  let account = null
  let timezone = 0

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

  const processLine = async args => {
    if (!account) throw new Error('Not logged in')

    switch (args.shift()) {
      case 'queue':
      case 'q':
        switch (args.shift()) {
          case 'list':
          case 'ls':
            {
              account.posts.sort((a, b) => a.time - b.time)
              let lines = ['Posts in the queue:']
              for (let i = 0; i < account.posts.length; i++) {
                let post = account.posts[i]
                let timeString = new Date(post.time).toLocaleString()
                if (i === 0) {
                  let countdown = post.time - Date.now()
                  let countdownMinutes = Math.floor(countdown / 60e3)
                  let countdownHours = Math.floor(countdownMinutes / 60)
                  countdownMinutes %= 60
                  timeString = `${timeString} (${countdown < 0 ? 'now' : `in ${countdownHours}h ${countdownMinutes}m`})`
                }
                let body = post.caption.replace(/\n+/g, '\n').replace(/^|(?<=\n)/g, '| ').replace(/\n\| (?=[^\n]*$)/, '\n+ ')
                lines.push(`+-[${i}] ${timeString} - ${post.url}`)
                lines.push(body)
                lines.push('')
              }
              await conn.send('line', lines.join('\n'))
            }
            break

          case 'add':
          case 'a':
            await conn.send('line', '`queue add` is disabled for security reasons')
            /*conn.handle('queue.add', post => {
              if (!account) throw new Error('Not logged in')
              if (typeof post.url !== 'string' || typeof post.caption !== 'string' || typeof post.time !== 'number')
                throw new Error('Invalid post data')
              account.posts.push({ url: post.url, caption: post.caption, time: post.time })
            })*/
            // await conn.send('queue.add', { url: args[0], caption: args[1], time: args[2] })
            break

          case 'set':
          case 's':
            {
              let id = +args[0]
              let post = account.posts[id]
              if (!post) throw new Error('Post not found')

              let key = args[1]
              if (key !== 'caption' && key !== 'time') {
                await conn.send('line', 'Only the caption and the time can be set')
                break
              }

              let value = key === 'time' ? new Date(args[2]).getTime() : args[2]
              if (typeof value !== ({ caption: 'string', time: 'number' })[key])
                throw new Error('Invalid key or value')
              post[key] = value
            }
            break

          case 'remove':
          case 'rm':
            {
              let id = +args[0]
              if (Number.isInteger(id) && id >= 0 && id < account.posts.length)
                account.posts.splice(id, 1)
              else
                throw new Error('Post not found')
            }
            break

          case 'clear':
          case 'c':
            account.posts = []
            break

          default:
            await conn.send('line', 'Invalid subcommand for queue')
            break
        }
        break

      case 'postGen':
      case 'pg':
        switch (args.shift() || null) {
          case null:
            await conn.send('line', `Config:\n${JSON.stringify(account.postGen)}`)
            break

          case 'enable':
            account.postGen.enabled = true
            break

          case 'disable':
            account.postGen.enabled = false
            break

          case 'set':
          case 's':
            {
              let key = args[0]
              if (key !== 'queueMax' && key !== 'category') {
                await conn.send('line', 'Only the queueMax and category can be set')
                break
              }

              let value =
                key === 'queueMax' ? +args[1] :
                  key === 'category' ? args[1] :
                    args.slice(1).map(t => +t)

              if (
                key === 'queueMax' && typeof value === 'number' ||
                key === 'category' && typeof value === 'string'
              ) {
                account.postGen[key] = value
              } else {
                throw new Error('Invalid key or value')
              }
            }
            break

          case 'schedule':
            await conn.send('line', 'New schedule:')
            {
              let dailyScheduledTimes = []
              for (let time of args) {
                let [start, end] = time.split('-')

                let today = new Date().toISOString().replace(/T.+/, 'T')
                let startToday = new Date(today + start)
                let endToday = new Date(today + end)

                await conn.send('line', `- one post between ${startToday.toLocaleTimeString()} and ${endToday.toLocaleTimeString()}`)
                dailyScheduledTimes.push({
                  start: getTimeOfDay(startToday),
                  end: getTimeOfDay(endToday),
                })
              }
              account.postGen.dailyScheduledTimes = dailyScheduledTimes
            }
            break

          default:
            await conn.send('line', 'Invalid subcommand for postGen')
            break
        }
        break

      case 'postRecycle':
      case 'pr':
        switch (args.shift() || null) {
          case null:
            await conn.send('line', `Config:\n${JSON.stringify(account.postRecycle)}`)
            break

          case 'enable':
            account.postRecycle.enabled = true
            break

          case 'disable':
            account.postRecycle.enabled = false
            break

          case 'set':
          case 's':
            {
              let key = args[0]
              if (key !== 'queueMax' && key !== 'interval') {
                await conn.send('line', 'Only the queueMax and interval can be set')
                break
              }

              let value = key === 'queueMax' ? +args[1] : +args[1] * 60 * 60e3
              if (
                key === 'enabled' && typeof value === 'boolean' ||
                key === 'queueMax' && typeof value === 'number' ||
                key === 'interval' && typeof value === 'number'
              ) {
                account.postRecycle[key] = value
              } else {
                throw new Error('Invalid key or value')
              }
            }
            break

          default:
            await conn.send('line', 'Invalid subcommand for postRecycle')
            break
        }
        break

      case 'headless':
        account.config = account.config || {}
        switch (args.shift()) {
          case 'enable':
            account.config.headless = true
            break
          case 'disable':
            account.config.headless = false
            break
        }

      case 'uncropped':
        account.config = account.config || {}
        switch (args.shift()) {
          case 'enable':
            account.config.expand = true
            break
          case 'disable':
            account.config.expand = false
            break
        }

      case 'skipWait':
      case 'now':
        skipWait() // TODO: debug command?
        break

      case 'help':
        // [......][......][......][......][......][......][......][......][......][......]
        await conn.send('line', [
          'queue list                              List the queue',
          // 'queue add    <url> <caption> <time>',
          // 'queue set    <id> url     <url>',
          'queue set    <id> caption <caption>     Set the caption of a post in the queue',
          'queue set    <id> time    <time>        Set the time of a post in the queue',
          'queue remove <id>                       Remove a post from the queue',
          'queue clear                             Remove all posts from the queue',
          '',
          'postGen                                 View the current post generation config',
          'postGen enable (or disable)             Enable or disable automatic post generation',
          'postGen set queueMax <number>           Set the maximum number of posts that the',
          '                                        queue can have before generation stops',
          'postGen set category <category>         Set the category of posts to generate',
          'postGen schedule [times] [times] ...    Set the times of day for post generation',
          '                Each time should be a range of times in 24-hour format, like in',
          '                "pg schedule 10:00-10:30 14:30-15:00"',
          '',
          'postRecycle                             View the current post recycling config',
          'postRecycle enable (or disable)         Enable or disable automatic post recycling',
          'postRecycle set queueMax <number>       Set the maximum number of posts that the',
          '                                        queue can have before recycling stops',
          'postRecycle set interval <hours>        Set the time between recycles in hours',
          '',
          'headless enable (or disable)            Prevent the Instagram window from being shown',
          'uncropped enable (or disable)           Prevent posts from being cropped',
          '',
          'Note: Arguments containing spaces or quotation marks must be put in quotes.',
          '      You can put "q" instead of "queue", "pg" instead of "postGen",',
          '      or "pr" instead of "postRecycle".'
        ].join('\n'))
        break

      default:
        await conn.send('line', 'Invalid command')
        break
    }

    await database.serverData.save()
  }

  conn.handle('timezone', to => timezone = to)

  conn.handle('auth', async newToken => {
    if (typeof newToken !== 'string')
      throw new Error('Token must be a string')
    if (token != null)
      throw new Error('Already logged in')
    let serverData = await database.serverData.get()
    if (!serverData.accounts.hasOwnProperty(newToken)) throw new Error('Account not found')
    token = newToken
    account = serverData.accounts[token]
    conn.send('line', 'Logged in successfully')
  })

  conn.handle('line', async line => {
    let args
    try {
      args = parseLine(line)
    } catch (err) {
      conn.send('line', 'Invalid quoted string in command')
      return
    }

    try {
      await processLine(args)
    } catch (err) {
      conn.send('line', `Failed to execute command: ${err.message}`)
    }
  })
}

let wss = new WebSocket.Server({ port: 6000 })

let puppets = []
wss.on('connection', async (ws, req) => {
  console.log('New connection')
  if (url.parse(req.url).pathname.replace(/\/+$/, '') === '/api/alpha') {
    createApiConnection(ws)
    return
  }

  let puppet = new Puppet(ws)
  puppets.push(puppet)
  ws.on('close', code => {
    console.log('Connection closed', code)
    let i = puppets.indexOf(puppet)
    if (i !== -1)
      puppets.splice(i, 1)
  })
})

let run = async () => {
  let serverData = await database.serverData.get()

  serverData.allPastPosts = serverData.allPastPosts.filter(post => post.madeAt + 7 * 24 * 60 * 60e3 > Date.now())

  for (let account of Object.values(serverData.accounts))
    try {
      account.posts.sort((a, b) => a.time - b.time)
    } catch (err) {
      console.log(err)
    }

  for (let puppet of puppets)
    try {
      if (!puppet.ready) continue

      let account = serverData.accounts[puppet.token]
      if (!account) continue

      let post = account.posts[0]
      if (post && post.time <= Date.now()) {
        account.posts.shift()
        await puppet.createPost(post.url, post.caption, account.config.expand || false)
      }
    } catch (err) {
      console.log(err)
    }

  for (let account of Object.values(serverData.accounts))
    try {
      let postGen = account.postGen || { enabled: false }
      if (!postGen.enabled) continue
      if (account.posts.length >= postGen.queueMax) continue
      if (postGen.dailyScheduledTimes.length === 0) continue

      let post = await redditPostGen.generatePost(postGen.category, serverData.allPastPosts).catch(err => console.log(err))
      if (!post) continue

      let madeAt = Date.now()

      let { time: lastPostTimestamp = madeAt } = account.posts[account.posts.length - 1] || {}
      let lastPostTime = getTimeOfDay(new Date(lastPostTimestamp))
      let bestTimeUntilMin = Infinity
      let bestTime = null
      for (let time of postGen.dailyScheduledTimes) {
        let timeUntilMin = subtractTimeOfDay(time.start, lastPostTime)
        if (timeUntilMin < bestTimeUntilMin) {
          bestTimeUntilMin = timeUntilMin
          bestTime = time
        }
      }

      post.time = lastPostTimestamp + subtractTimeOfDay(bestTime.start, lastPostTime) + Math.floor((bestTime.end - bestTime.start) * Math.random())

      account.posts.push(post)
      serverData.allPastPosts.push({ id: post.id, madeAt })
      console.log('Generated post', post)
    } catch (err) {
      console.log(err)
    }

  for (let [token, account] of Object.entries(serverData.accounts))
    try {
      let postRecycle = account.postRecycle || { enabled: false }
      if (!postRecycle.enabled) continue
      if (account.posts.length >= postRecycle.queueMax) continue

      let puppet = puppets.find(r => r.token === token)
      if (!puppet) continue

      await puppet.goToSelfProfile()
      await puppet.goToOldestPostFromProfile()

      let { time: lastPostTime = Date.now() } = account.posts[account.posts.length - 1] || {}
      let post = {
        url: await puppet.postGetMediaSrc(),
        caption: await puppet.postGetCaption(),
        time: lastPostTime + postRecycle.interval,
      }

      await puppet.postDelete()

      account.posts.push(post)
      console.log('Recycled post', post)
    } catch (err) {
      console.log(err)
    }

  await database.serverData.save()
}

let skipWait = () => {}

;(async () => {
  while (true) {
    await run()
    await Promise.race([
      sleep(60e3),
      new Promise(resolve => skipWait = resolve)
    ])
  }
})()