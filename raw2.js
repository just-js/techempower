const stringify = require('@stringify')
const justify = require('@justify')
const postgres = require('@pg')
const html = require('@html')
const config = require('techempower.config.js')

const { createConnectionPool, compile, compileBatchUpdate, compileMultiQuery } = postgres
const { BinaryInt, VarChar } = postgres.pg
const { createServer } = justify
const { sjs, attr } = stringify

const extra = { id: 0, message: 'Additional fortune added at request time.' }
const sDB = sjs({ id: attr('number'), randomnumber: attr('number') })
const sJSON = sjs({ message: attr('string') })
const message = 'Hello, World!'
const json = { message }
const { maxRandom, maxQuery, templates } = config
const getRandom = () => Math.ceil(Math.random() * maxRandom)

function sortByMessage (a, b) {
  if (a.message > b.message) return 1
  if (a.message < b.message) return -1
  return 0
}

async function compileQueries (db) {
  db.getWorldById = await compile(db,
    'select id, randomnumber from World where id = $1', '1',
    [BinaryInt], [BinaryInt], [1], false, false)
  db.getAllFortunes = await compile(db, 'select * from Fortune',
    '2', [BinaryInt, VarChar], [], [], true)
  db.getRandomWorlds = compileMultiQuery(db.getWorldById, () => [getRandom()])
}

async function main () {
  const { port, address } = config.server
  const poolSize = parseInt(just.env().PGPOOL || just.sys.cpus, 10)

  const fortunes = html.load(templates.fortunes, templates.settings)
  const pool = await createConnectionPool(config.db, poolSize, compileQueries)
  const getCount = qs => Math.min(parseInt((qs.q) || 1, 10), maxQuery) || 1

  const server = createServer()
    .get('/query', (req, res) => {
      const { getWorldById } = res.socket
      const queries = getCount(req.query)
      const results = []
      for (let i = 1; i < queries; i++) {
        getWorldById.params[0] = getRandom()
        getWorldById.append(() => {
          const [id, randomnumber] = getWorldById.getRows()[0]
          results.push({ id, randomnumber })
        }, (i % 20 === 0))
      }
      getWorldById.params[0] = getRandom()
      getWorldById.append(() => {
        const [id, randomnumber] = getWorldById.getRows()[0]
        results.push({ id, randomnumber })
        res.json(`[${results.map(row => sDB(row)).join(',')}]`)
      })
      getWorldById.send()
    }, { qs: true })
    .get('/update', async (req, res) => {
      const { getRandomWorlds, db } = res.socket
      const count = getCount(req.query)
      const rows = (await getRandomWorlds(count))
        .map(row => Object.assign(row[0], { randomnumber: getRandom() }))
      let batchUpdate = getRandomWorlds.batchUpdate[count]
      if (!batchUpdate) {
        batchUpdate = getRandomWorlds.batchUpdate[count] = compileBatchUpdate(db, getRandomWorlds.nextId++, 'world', 'randomnumber', 'id', count)
      }
      batchUpdate = await batchUpdate
      await batchUpdate.call(...rows.flatMap(row => [row.id, row.randomnumber]))
      res.json(JSON.stringify(rows))
    }, { qs: true })
    .get('/fortunes', (req, res) => {
      const { getAllFortunes } = res.socket
      getAllFortunes.call(err => {
        if (err) return server.serveError(req, res, err)
        res.html(fortunes.call([extra, ...getAllFortunes.getRows().map(e => ({ id: e[0], message: e[1] }))].sort(sortByMessage)))
      })
    })
    .get('/plaintext', (req, res) => res.text(message))
    .get('/json', (req, res) => res.json(sJSON(json)))
    .get('/db', (req, res) => {
      const { getWorldById } = res.socket
      getWorldById.params[0] = getRandom()
      getWorldById.call(err => {
        if (err) return server.serveError(req, res, err)
        const [id, randomNumber] = getWorldById.getRows()[0]
        res.json(sDB({ id, randomNumber }))
      })
    })
    .connect(sock => {
      const client = pool[sock.fd % pool.length]
      const { getWorldById, getAllFortunes, getRandomWorlds } = client
      sock.db = client
      sock.getWorldById = getWorldById.query
      sock.getRandomWorlds = getRandomWorlds
      if (!getRandomWorlds.batchUpdate) {
        getRandomWorlds.batchUpdate = {}
        getRandomWorlds.nextId = 3
      }
      sock.getAllFortunes = getAllFortunes.query
    })
    .listen(port, address)
}

main().catch(err => just.error(err.stack))
