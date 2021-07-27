const stringify = require('@stringify')
const justify = require('../libs/justify/justify.js')
const config = require('config.js')
const postgres = require('../libs/pg/pg.js')
const cache = require('../libs/cache/cache.js')
const html = require('../libs/html/html.js')

const { Connection, compile, compileBatchUpdate, compileMultiQuery } = postgres
const { BinaryInt, VarChar } = postgres.pg
const { createServer } = justify
const { sjs, attr } = stringify
const { SimpleCache } = cache
const { maxRandom, maxQuery } = config
const { port, address } = config.server

const getRandom = () => Math.ceil(Math.random() * maxRandom)
const getCount = qs => Math.min(parseInt((qs.q) || 1, 10), maxQuery) || 1

async function compileQueries (db, maxQuery, getRandom) {
  db.getWorldById = await compile(db,
    'select id, randomNumber from World where id = $1', 's1',
    [BinaryInt], [BinaryInt], [1], false, false)
  db.getWorldByIdRaw = await compile(db,
    'select id, randomNumber from World where id = $1', 's3',
    [BinaryInt], [BinaryInt], [1], false, true)
  db.getAllFortunes = await compile(db, 'select * from Fortune',
    's2', [BinaryInt, VarChar], [], [], true)
  db.getRandomWorlds = compileMultiQuery(db.getWorldById, () => [getRandom()])
  db.getRandomWorldsRaw = compileMultiQuery(db.getWorldByIdRaw, () => [getRandom()])
  db.batchUpdates = []
  const promises = []
  for (let i = 1; i < maxQuery + 1; i++) {
    promises.push(compileBatchUpdate(db, `b${i}`, 'world',
      'randomnumber', 'id', i))
    if (i % 10 > 0) continue
    db.batchUpdates = db.batchUpdates.concat((await Promise.all(promises)))
    promises.length = 0
  }
}

async function main () {
  const extra = { id: 0, message: 'Additional fortune added at request time.' }
  const sDB = sjs({ id: attr('number'), randomnumber: attr('number') })
  const sJSON = sjs({ message: attr('string') })
  const message = 'Hello, World!'
  const json = { message }
  const fortunes = html.load(config.templates.fortunes, { rawStrings: false, compile: true })

  for (let i = 0; i < poolSize; i++) {
    const db = new Connection(config.db)
    await db.connect()
    await compileQueries(db, maxQuery, getRandom)
    just.print(`client ${i} added to pool`)
    clients.push(db)
  }

  // todo - use grid as in memory cache
  const server = createServer()
    .get('/json', (req, res) => res.json(sJSON(json)))
    .get('/plaintext', (req, res) => res.text(message))
    .get('/db4', (req, res) => {
      const { query } = res.socket.getWorldById
      query.call(err => {
        if (err) return server.serverError(req, res, err)
        res.json(JSON.stringify(query.getRows()))
      })
    })
    .get('/db', async (req, res) => {
      const rows = await res.socket.getWorldById.call(getRandom())
      res.json(sDB(rows[0]))
    })
    .get('/db2', async (req, res) => {
      const rows = await res.socket.getWorldByIdRaw.call(getRandom())
      const [id, randomnumber] = rows[0]
      res.json(sDB({ id, randomnumber }))
    })
    .get('/db3', async (req, res) => {
      const rows = await res.socket.getWorldByIdRaw.call(getRandom())
      const row = rows[0]
      res.json(`{"id":${row[0]},"randomnumber":${row[1]}}`)
    })
    .get('/query', async (req, res) => {
      const rows = await res.socket.getRandomWorlds(getCount(req.query))
      res.json(JSON.stringify(rows.map(r => r[0])))
    }, { qs: true })
    .get('/query2', async (req, res) => {
      const rows = await res.socket.getRandomWorldsRaw(getCount(req.query))
      res.json(JSON.stringify(rows.map(r => r[0])))
    }, { qs: true })
    .get('/update', async (req, res) => {
      const count = getCount(req.query)
      const rows = (await res.socket.getRandomWorlds(count))
        .map(row => Object.assign(row[0], { randomnumber: getRandom() }))
      await res.socket.batchUpdates[count - 1]
        .call(...rows.flatMap(row => [row.id, row.randomnumber]))
      res.json(JSON.stringify(rows))
    }, { qs: true })
    .get('/fortunes', async (req, res) => {
      const rows = await res.socket.getAllFortunes.call()
      res.html(fortunes.call([extra, ...rows].sort()))
    })
    .get('/cached-worlds', async (req, res) => {
      const count = getCount(req.query || { q: 1 })
      const promises = []
      for (let i = 0; i < count; i++) {
        promises.push(res.socket.worldCache.get(getRandom()))
      }
      const rows = (await Promise.all(promises)).map(v => v[0])
      res.json(JSON.stringify(rows))
    }, { qs: true })
    .connect(sock => {
      const client = clients[sock.fd % clients.length]
      const { getWorldById, getWorldByIdRaw, getAllFortunes, batchUpdates, getRandomWorlds, getRandomWorldsRaw } = client
      const worldCache = new SimpleCache(id => getWorldById.call(id)).start()
      sock.getWorldById = getWorldById
      sock.getWorldByIdRaw = getWorldByIdRaw
      sock.getAllFortunes = getAllFortunes
      sock.batchUpdates = batchUpdates
      sock.getRandomWorlds = getRandomWorlds
      sock.getRandomWorldsRaw = getRandomWorldsRaw
      sock.worldCache = worldCache
    })
    .listen(port, address)
  server.stackTraces = true
  server.name = 'j'
}

const clients = []
const poolSize = parseInt(just.env().PGPOOL || just.sys.cpus, 10)

main().catch(err => just.error(err.stack))

/*
just.setInterval(() => {
  const { user, system } = just.cpuUsage()
  const { rss } = just.memoryUsage()
  just.print(`mem ${rss} cpu (${user.toFixed(2)}/${system.toFixed(2)}) ${(user + system).toFixed(2)}`)
}, 1000)
*/
