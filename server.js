const fs = require('fs').promises
const https = require('https')
const readline = require('readline')
const url = require('url')

const WebSocket = require('ws')

const Connection = require('./connection')
const { sleep, random, delay } = require('./shared')

const redditPostGen = require('./redditPostGen')

let database = {
  serverData: { // TODO: this is done badly
    cache: null,
    async get() {
      if (this.cache) return this.cache
      try {
        this.cache = JSON.parse(await fs.readFile(__dirname + '/data/serverData.json'))
        return this.cache
      } catch (err) {
        return null
      }
    },
    async set(data) {
      this.cache = data
      try {
        await fs.mkdir(__dirname + '/data')
      } catch (err) {
        if (err.code !== 'EEXIST')
          throw err
      }
      await fs.writeFile(__dirname + '/data/serverData.json', JSON.stringify(data))
    },
  },
}

const Puppet = class {
  constructor(ws) {
    this.token = null
    this.conn = new Connection(ws)
    this.conn.handle('auth', async token => {
      this.token = token
      await this.launch(false)
      await this.load()
      await this.login()
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

  async createPost(path, caption) {
    return this.cmd('createPost', path, caption)
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

let wss = new WebSocket.Server({ port: 6000 })

let puppets = []
wss.on('connection', async (ws, req) => {
  console.log('New connection')
  if (url.parse(req.url).pathname.replace(/\/+$/, '') === '/api/alpha') {
    let serverData = (await database.serverData.get()) || { accounts: {} }
    await database.serverData.set(serverData)

    let token = null // TODO: this is kinda bad?
    let account = null

    let conn = new Connection(ws)

    conn.handle('auth', newToken => {
      if (typeof newToken !== 'string')
        throw new Error('Token must be a string')
      token = newToken
      account = serverData.accounts[token]
      if (!account) throw new Error('Account not found')
    })

    conn.handle('queue.get', () => {
      if (!account) throw new Error('Not logged in')
      account.posts.sort((a, b) => a.time - b.time)
      return account.posts
    })

    /*conn.handle('queue.add', post => {
      if (!account) throw new Error('Not logged in')
      if (typeof post.url !== 'string' || typeof post.caption !== 'string' || typeof post.time !== 'number')
        throw new Error('Invalid post data')
      account.posts.push({ url: post.url, caption: post.caption, time: post.time })
    })*/

    conn.handle('queue.set', ({ id, key, value }) => {
      if (!account) throw new Error('Not logged in')
      let post = account.posts[id]
      if (!post) throw new Error('Post not found')
      if (typeof value !== ({ /*url: 'string',*/ caption: 'string', time: 'number' })[key])
        throw new Error('Invalid key or value')
      post[key] = value
    })

    conn.handle('queue.remove', ({ id }) => {
      if (!account) throw new Error('Not logged in')
      if (id === '*')
        account.posts = []
      else if (Number.isInteger(id) && id >= 0 && id < account.posts.length)
        account.posts.splice(id, 1)
      else
        throw new Error('Post not found')
    })

    conn.handle('postGen.configGet', () => {
      if (!account) throw new Error('Not logged in')
      return account.postGen
    })

    conn.handle('postGen.configSet', ({ key, value }) => {
      if (!account) throw new Error('Not logged in')
      if (
        key === 'enabled' && typeof value === 'boolean' ||
        key === 'queueMax' && typeof value === 'number' ||
        key === 'category' && typeof value === 'string' ||
        key === 'dailyScheduledTimes' && Array.isArray(value) && value.every(time => {
          return typeof time === 'object' && typeof time.start === 'number' && typeof time.end === 'number'
        })
      ) {
        account.postGen[key] = value
      } else {
        throw new Error('Invalid key or value')
      }
    })

    conn.handle('postRecycle.configGet', () => {
      if (!account) throw new Error('Not logged in')
      return account.postRecycle
    })

    conn.handle('postRecycle.configSet', ({ key, value }) => {
      if (!account) throw new Error('Not logged in')
      if (
        key === 'enabled' && typeof value === 'boolean' ||
        key === 'queueMax' && typeof value === 'number' ||
        key === 'interval' && typeof value === 'number'
      ) {
        account.postRecycle[key] = value
      } else {
        throw new Error('Invalid key or value')
      }
    })

    conn.handle('sudo.skipWait', () => skipWait()) // TODO: debug command?

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

const getTimeOfDay = date => ((date.getUTCHours() * 60 + date.getUTCMinutes()) * 60 + date.getUTCSeconds()) * 1000 + date.getUTCMilliseconds()
const subtractTimeOfDay = (a, b) => ((a - b + 86400e3) % 86400e3) || 86400e3

let run = async () => {
  let serverData = (await database.serverData.get()) || { accounts: {}, allPastPosts: [] }
  await database.serverData.set(serverData)

  serverData.allPastPosts = serverData.allPastPosts.filter(post => post.madeAt + 7 * 24 * 60 * 60e3 > Date.now())

  for (let account of Object.values(serverData.accounts)) {
    account.posts.sort((a, b) => a.time - b.time)
  }

  for (let puppet of puppets) {
    let account = serverData.accounts[puppet.token]
    if (!account) continue

    let post = account.posts[0]
    if (post && post.time <= Date.now()) {
      account.posts.shift()
      await puppet.createPost(post.url, post.caption)
    }
  }

  for (let account of Object.values(serverData.accounts)) {
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
    serverData.allPastPosts.push({ url: post.url, madeAt })
    console.log('Generated post', post)
  }

  for (let [token, account] of Object.entries(serverData.accounts)) {
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
  }

  await database.serverData.set(serverData)
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