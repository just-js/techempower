const stringify = require('@stringify')
const justify = require('@justify')
const postgres = require('@pg')
const cache = require('@cache')
const html = require('@html')
const config = require('config.js')

const { createConnectionPool, compile, compileBatchUpdate, compileMultiQuery } = postgres
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
  db.getAllFortunes = await compile(db, 'select * from Fortune',
    's2', [BinaryInt, VarChar], [], [], true)
  db.getRandomWorlds = compileMultiQuery(db.getWorldById, () => [getRandom()])
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
  const poolSize = parseInt(just.env().PGPOOL || just.sys.cpus, 10)
  const clients = await createConnectionPool(config.db, poolSize, db => compileQueries(db, maxQuery, getRandom))

  function sortByMessage (a, b) {
    if (a.message > b.message) return 1
    if (a.message < b.message) return -1
    return 0
  }
  const server = createServer()
    .get('/json', (req, res) => res.json(sJSON(json)))
    .get('/plaintext', (req, res) => res.text(message))
    .get('/db', async (req, res) => {
      const { getWorldById } = res.socket
      const rows = await getWorldById.call(getRandom())
      res.json(sDB(rows[0]))
    })
    .get('/query', async (req, res) => {
      const { getRandomWorlds } = res.socket
      const rows = await getRandomWorlds(getCount(req.query))
      res.json(JSON.stringify(rows.map(r => r[0])))
    }, { qs: true })
    .get('/update', async (req, res) => {
      const { getRandomWorlds, batchUpdates } = res.socket
      const count = getCount(req.query)
      const rows = (await getRandomWorlds(count))
        .map(row => Object.assign(row[0], { randomnumber: getRandom() }))
      await batchUpdates[count - 1]
        .call(...rows.flatMap(row => [row.id, row.randomnumber]))
      res.json(JSON.stringify(rows))
    }, { qs: true })
    .get('/fortunes', async (req, res) => {
      const rows = await res.socket.getAllFortunes.call()
      res.html(fortunes.call([extra, ...rows].sort(sortByMessage)))
    })
    .get('/cached-worlds', async (req, res) => {
      const { worldCache } = res.socket
      const count = getCount(req.query || { q: 1 })
      const promises = []
      for (let i = 0; i < count; i++) {
        promises.push(worldCache.get(getRandom()))
      }
      const rows = (await Promise.all(promises)).map(v => v[0])
      res.json(JSON.stringify(rows))
    }, { qs: true })
    .connect(sock => {
      const client = clients[sock.fd % clients.length]
      const { getWorldById, getAllFortunes, batchUpdates, getRandomWorlds } = client
      const worldCache = new SimpleCache(id => getWorldById.call(id)).start()
      sock.getWorldById = getWorldById
      sock.getAllFortunes = getAllFortunes
      sock.batchUpdates = batchUpdates
      sock.getRandomWorlds = getRandomWorlds
      sock.worldCache = worldCache
    })
    .listen(port, address)
  server.name = 'j'
}

main().catch(err => just.error(err.stack))

just.setInterval(() => {
  const { user, system } = just.cpuUsage()
  const { rss } = just.memoryUsage()
  just.print(`mem ${rss} cpu (${user.toFixed(2)}/${system.toFixed(2)}) ${(user + system).toFixed(2)}`)
}, 1000)
