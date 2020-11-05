const { request, requestWithPostData } = require('./shared')

const allHashtag = async keyword => {
  let payload = `keyword=${keyword}&filter=top`
  let res = await requestWithPostData('https://www.all-hashtag.com/library/contents/ajax_generator.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Content-Length': payload.length.toString(),
    },
  }, payload)

  let match = res.toString().match(/<div\s+id="copy-hashtags"\s+class="copy-hashtags">([^<>]*)<\/div>/)
  if (!match) throw new Error('Hashtag element not found, site may have updated')

  let hashtags = match[1].trim().split(/\s+/)
  if (hashtags.length <= 1) throw new Error('Too few hashtags found')

  return hashtags
}

const bestHashtags = async keyword => {
  let res = await request(`https://best-hashtags.com/hashtag/${keyword}/`)

  let match = res.toString().match(/<p1>([^<>]*)<\/p1>/) // p2 also exists
  if (!match) throw new Error('Hashtag element not found, site may have updated')

  let hashtags = match[1].trim().split(/\s+/)
  if (hashtags.length <= 1) throw new Error('Too few hashtags found')

  return hashtags
}

const topHashtags = async keyword => {
  let hashtags = []

  for (let i = 1; i <= 5; i++) {
    let res = await request(`https://top-hashtags.com/search/?q=${keyword}&opt=top&sp=${i}`)

    let matches = res.toString().match(/(?<=<div class="i-tag"><a href="\/hashtag\/)([^\/"]+)(?=\/">#\1<\/a><\/div>)/g)
    if (!matches) break

    if (matches.length > 15) throw new Error('Too many hashtag elements found, site may have updated')

    for (let link of matches)
      hashtags.push(`#${link}`)
  }

  if (hashtags.length <= 1) throw new Error('Too few hashtags found')

  return hashtags
}

module.exports = {
  allHashtag,
  bestHashtags,
  topHashtags,
}
