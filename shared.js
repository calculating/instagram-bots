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

const request = async (...args) => new Promise((resolve, reject) => {
  let req = https.request(...args, res => {
    let chunks = []
    res.on('data', data => chunks.push(data))
    res.on('end', () => resolve(Buffer.concat(chunks)))
    res.on('error', reject)
  })
  req.on('error', reject)
  req.end()
})

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

module.exports = { sleep, random, delay, downloadFile, request, requestJson }