const fs = require('fs').promises
const fsSync = require('fs')
const https = require('https')

const sleep = time => new Promise(resolve => setTimeout(resolve, time))

const random = (min, max) => min + (max - min) * (Math.random() + Math.random() + Math.random()) / 3

const delay = async type => {
  if (type === 'veryFast') { // for general fast delays (e.g. get rid of animation)
    await sleep(random(500, 1000))
  } else if (type === 'fast') { // for general fast delays (e.g. get rid of animation)
    await sleep(random(1000, 1500))
  } else if (type === 'network') { // for delays with a simple network request (e.g. like)
    await sleep(random(2000, 3000))
  } else if (type === 'long') { // for longer delays that may need extra processing (e.g. log in)
    await sleep(random(5000, 7500))
  } else {
    throw new Error(`Invalid sleep delay '${type}'`)
  }
}

const consumeStream = stream => new Promise((resolve, reject) => {
  let chunks = []
  stream.on('data', data => chunks.push(data))
  stream.on('end', () => resolve(Buffer.concat(chunks)))
  stream.on('error', reject)
})

const requestWithPostData = async (...args) => {
  let postData = args.pop()
  let res = await new Promise((resolve, reject) => {
    let req = https.request(...args, resolve)
    req.on('error', reject)
    if (postData)
      req.write(postData)
    req.end()
  })
  return consumeStream(res)
}

const request = (...args) => requestWithPostData(...args, null)

const requestJson = async (...args) => JSON.parse(await request(...args))

const downloadFile = (src, path) => new Promise((resolve, reject) => {
  let file = fsSync.createWriteStream(path)
  let req = https.get(src, res => {
    res.pipe(file)
    file.on('finish', () => file.close(resolve))
  }).on('error', err => {
    reject(err)
    fs.unlink(path).catch(() => {})
  })
})

module.exports = {
  sleep,
  random,
  delay,
  requestWithPostData,
  request,
  requestJson,
  downloadFile,
}