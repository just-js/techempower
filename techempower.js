const justify = require('@justify')
const postgres = require('@pg')
const html = require('@html')
const util = require('util.js')

const config = require('tfb.js')

const { httpd, db, templates } = config
const { port, address } = httpd
const { connect } = postgres
const { createServer } = justify
const {
  setupConnection, sortByMessage, spray, getRandom, getCount, threadify
} = util

async function main () {
  const poolSize = parseInt(just.env().PGPOOL || just.sys.cpus, 10)
  const extra = { id: 0, message: 'Additional fortune added at request time.' }
  const message = 'Hello, World!'
  const json = { message }
  const template = html.load(templates.fortunes, templates.settings)

  // create connection pool and await connections
  const pool = await connect(db, poolSize)
  // compile and prepare sql statements when we connect to each database
  await Promise.all(pool.map(setupConnection))

  // the connection pool is created and bootstrapped, set up the web server
  const server = createServer(httpd)
    .get('/update', async (req, res) => {
      const { getWorldsById, updates } = res.socket.db
      const count = getCount(req.query)
      const worlds = await getWorldsById(spray(count, getRandom))
      const updateWorlds = updates[count]
      let i = 0
      for (const world of worlds) {
        world.randomnumber = getRandom()
        updateWorlds.query.params[i++] = world.id
        updateWorlds.query.params[i++] = world.randomnumber
      }
      await updateWorlds.runSingle()
      res.json(JSON.stringify(worlds))
    }, { qs: true })
    .get('/db', async (req, res) => {
      const { getWorldById } = res.socket.db
      res.json(JSON.stringify(await getWorldById(getRandom())))
    })
    .get('/fortunes', async (req, res) => {
      const { getAllFortunes } = res.socket.db
      const fortunes = await getAllFortunes()
      res.html(template.call(sortByMessage([extra, ...fortunes])))
    })
    .get('/query', async (req, res) => {
      const { getWorldsById } = res.socket.db
      const worlds = await getWorldsById(spray(getCount(req.query), getRandom))
      res.json(JSON.stringify(worlds))
    }, { qs: true })
    .get('/json', (req, res) => res.json(JSON.stringify(json)))
    .get('/plaintext', (req, res) => res.text(message))
    .get('/cached-world', async (req, res) => {
      const { worldCache } = res.socket.db
      const count = getCount(req.query)
      const worlds = await Promise.all(spray(count, worldCache.getRandom))
      res.json(JSON.stringify(worlds))
    }, { qs: true })
    .connect(sock => {
      sock.db = pool[sock.fd % poolSize]
    })

  if (!server.listen(port, address)) {
    throw new just.SystemError(`Could Not Listen on ${address}:${port}`)
  }
  just.print(`listening on ${address}:${port}`)
}

if (just.sys.tid() !== just.sys.pid()) {
  main().catch(err => just.error(err.stack))
} else {
  threadify()
}
