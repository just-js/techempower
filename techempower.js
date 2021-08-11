// requires
const justify = require('@justify')
const postgres = require('../libs/pg/pg.js')
const html = require('@html')
const util = require('util.js')
const cache = require('@cache')

// config
const config = require('techempower.config.js')

// namespace and config imports
const { connect } = postgres
const { createServer } = justify
const { maxRandom, maxQuery, httpd, queries, db, templates } = config
const { port, address } = httpd
const { generateBulkUpdate, sortByMessage, sprayer } = util
const { SimpleCache } = cache

// helper functions
const spray = sprayer(maxQuery)
const getRandom = () => Math.ceil(Math.random() * maxRandom)
const getCount = (qs = { q: 1 }) => (Math.min(parseInt((qs.q) || 1, 10), maxQuery) || 1)

async function setupConnection (sock) {
  const { worlds, fortunes } = queries
  const updates = [{ run: () => Promise.resolve([]) }]
  const fortunesQuery = await sock.create(fortunes, 1)
  const worldsQuery = await sock.create(worlds, maxQuery)
  for (let i = 1; i <= maxQuery; i++) {
    const update = generateBulkUpdate('world', 'randomnumber', 'id', i)
    const bulk = Object.assign(queries.update, update)
    updates.push(await sock.create(bulk))
  }
  sock.getWorldById = id => {
    worldsQuery.query.params[0] = id
    return worldsQuery.runSingle()
  }
  sock.getAllFortunes = () => fortunesQuery.runSingle()
  sock.getWorldsById = ids => worldsQuery.runBatch(ids)
  sock.updates = updates
  sock.worldCache = new SimpleCache(id => sock.getWorldById(id)).start()
}

// async main. any exceptions will be caught in the handler below
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
      res.html(template.call(sortByMessage([extra, ...(await getAllFortunes())])))
    })
    .get('/query', async (req, res) => {
      const { getWorldsById } = res.socket.db
      const worlds = await getWorldsById(spray(getCount(req.query), getRandom))
      res.json(JSON.stringify(worlds))
    }, { qs: true })
    .get('/json', (req, res) => res.json(JSON.stringify(json)))
    .get('/plaintext', (req, res) => res.text(message))
    .get('/cached-worlds', async (req, res) => {
      const { worldCache } = res.socket.db
      const worlds = await Promise.all(spray(getCount(req.query), () => worldCache.get(getRandom())))
      res.json(JSON.stringify(worlds))
    }, { qs: true })
    .connect(sock => {
      sock.db = pool[sock.fd % poolSize]
    })

  // listen on the given port and address
  const ok = server.listen(port, address)
  if (!ok) throw new just.SystemError(`Could Not Listen on ${address}:${port}`)
  just.print(`listening on ${address}:${port}`)
}

main().catch(err => just.error(err.stack))
