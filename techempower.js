const stringify = require('@stringify')
const justify = require('@justify')
const html = require('@html')
const util = require('util.js')
const config = require('tfb.config.js')

async function main () {
  const { setup, sortByMessage, spray, getRandom, getCount } = util
  const extra = { id: 0, message: 'Additional fortune added at request time.' }
  const message = 'Hello, World!'
  const json = { message }
  const sJSON = stringify.sjs({ message: stringify.attr('string') })
  const { db, templates, httpd } = config
  const template = html.load(templates.fortunes, templates.settings)
  const {
    getWorldsById, updateWorlds, getWorldById,
    getAllFortunes, worldCache
  } = await setup(db)

  const server = justify.createServer(httpd)
  server.get('/plaintext', res => res.text(message))
  server.get('/json', res => res.json(sJSON(json)))
  server.get('/db', async res => {
    res.json(JSON.stringify(await getWorldById(getRandom())))
  })
  server.get('/query', async (res, req) => {
    const count = getCount(req.parseUrl(true).query)
    const worlds = await getWorldsById(spray(count, getRandom))
    res.json(JSON.stringify(worlds))
  })
  server.get('/update', async (res, req) => {
    const count = getCount(req.parseUrl(true).query)
    const worlds = await getWorldsById(spray(count, getRandom))
    await updateWorlds(worlds, count)
    res.json(JSON.stringify(worlds))
  })
  server.get('/fortunes', async res => {
    res.html(template.call(sortByMessage([extra, ...await getAllFortunes()])))
  })
  server.get('/cached-world', async (res, req) => {
    const count = getCount(req.parseUrl(true).query)
    const worlds = await Promise.all(spray(count, worldCache.getRandom))
    res.json(JSON.stringify(worlds))
  })
  server.listen(httpd.port, httpd.address)
}

if (just.args.length > 1) {
  main().catch(err => just.error(err.stack))
} else {
  const process = require('process')
  const { watch, launch } = process
  const proc = parseInt(just.env().CPUS || just.sys.cpus, 10)
  for (let i = 0; i < proc; i++) {
    watch(launch(just.args[0], ['main'])).then(() => {})
  }
}
