const justify = require('@justify')
const postgres = require('@pg')
const html = require('@html')
const util = require('util.js')
const config = require('tfb.config.js')
const threadify = require('@threadify')

const { setupConnection, sortByMessage, spray, getRandom, getCount } = util

async function main () {
  const extra = { id: 0, message: 'Additional fortune added at request time.' }
  const message = 'Hello, World!'
  const json = { message }
  const template = html.load(config.templates.fortunes, config.templates.settings)

  const sock = (await postgres.connect(config.db, 1))[0]
  await (setupConnection(sock))

  const { getWorldsById, updateWorlds, getWorldById, getAllFortunes, worldCache } = sock

  let conn = 0

  const server = justify.createServer(config.httpd)
  server.get('/update', async (res, req) => {
    const count = getCount(req.parseUrl(true).query)
    const worlds = await getWorldsById(spray(count, getRandom))
    await updateWorlds(worlds, count)
    res.json(JSON.stringify(worlds))
  })
  server.get('/query', async (res, req) => {
    const count = getCount(req.parseUrl(true).query)
    const worlds = await getWorldsById(spray(count, getRandom))
    res.json(JSON.stringify(worlds))
  })
  server.get('/fortunes', async res => {
    res.html(template.call(sortByMessage([extra, ...await getAllFortunes()])))
  })
  server.get('/db', async res => {
    res.json(JSON.stringify(await getWorldById(getRandom())))
  })
  server.get('/json', res => res.json(JSON.stringify(json)))
  server.get('/plaintext', res => res.text(message))
  server.get('/cached-world', async (res, req) => {
    const count = getCount(req.parseUrl(true).query)
    const worlds = await Promise.all(spray(count, worldCache.getRandom))
    res.json(JSON.stringify(worlds))
  })
  server.listen(config.httpd.port, config.httpd.address)
  if (just.env().TFBTRACE) {
    server.connect(() => conn++)
    server.disconnect(() => conn--)
    just.setInterval(() => {
      const { worlds, fortunes, parser } = sock.stats()
      just.print(`chld ${just.sys.tid()} conn ${conn} worlds: p ${worlds.pending} s ${worlds.syncing} fortunes: p ${fortunes.pending} s ${fortunes.syncing}`)
      just.print(JSON.stringify(parser, null, '  '))
    }, 1000)
  }
}

threadify.spawn(main)
