const stringify = require('@stringify')
const justify = require('@justify')
const postgres = require('../libs/pg/pg.js')
const config = require('techempower.config.js')

const { createConnectionPool, compile } = postgres
const { BinaryInt } = postgres.pg
const { createServer } = justify
const { sjs, attr } = stringify
const { maxRandom, maxQuery } = config
const { port, address } = config.server

const getRandom = () => Math.ceil(Math.random() * maxRandom)
const getCount = qs => Math.min(parseInt((qs.q) || 1, 10), maxQuery) || 1

async function compileQueries (db, maxQuery, getRandom) {
  db.getWorldById = await compile(db,
    'select id, randomNumber from World where id = $1', 's1',
    [BinaryInt], [BinaryInt], [1], false, false)
}

async function main () {
  const sDB = sjs({ id: attr('number'), randomnumber: attr('number') })
  const poolSize = parseInt(just.env().PGPOOL || just.sys.cpus, 10)
  const clients = await createConnectionPool(config.db, poolSize, db => compileQueries(db, maxQuery, getRandom))

  const server = createServer()
    .get('/db', async (req, res) => {
      const { getWorldById } = res.socket
      const rows = await getWorldById.call(getRandom())
      res.json(sDB(rows[0]))
    })
    .get('/query', async (req, res) => {
      const { getWorldById } = res.socket
      const count = getCount(req.query)
      const rows = []
      for (let i = 0; i < count; i++) {
        const world = (await getWorldById.call(getRandom()))
        rows.push(world)
      }
      res.json(JSON.stringify(rows))
    }, { qs: true })
    .connect(sock => {
      const client = clients[sock.fd % clients.length]
      const { getWorldById } = client
      sock.getWorldById = getWorldById
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
