const stringify = require('@stringify')
const justify = require('@justify')
const postgres = require('pg.js')
const config = require('techempower.config.js')

const { createPool, compile, createBatchMessages } = postgres
const { createServer } = justify
const { sjs, attr } = stringify
const { maxRandom, maxQuery } = config
const { port, address } = config.server

const getRandom = () => Math.ceil(Math.random() * maxRandom)
const getCount = qs => Math.min(parseInt((qs.q) || 1, 10), maxQuery) || 1

async function onConnect (sock) {
  sock.setNoDelay(1)
  const query = config.queries.worlds
  const { name, sql, portal, formats, fields, params } = query
  sock.getWorldById = await compile(sock, name, sql, portal, formats, fields, params)
  sock.getWorldByIdMulti = createBatchMessages(20, query, sock)
}

function createArray (count, fn) {
  return (new Array(count)).fill(1).map(fn)
}

async function main () {
  const sDB = sjs({ id: attr('number'), randomnumber: attr('number') })
  const poolSize = parseInt(just.env().PGPOOL || just.sys.cpus, 10)
  const connections = await createPool(config.db, poolSize, onConnect)
  const server = createServer()
    .get('/db', async (req, res) => {
      res.json(sDB(await res.socket.connection.getWorldByIdMulti(getRandom())))
    })
    .get('/query', async (req, res) => {
      res.json(JSON.stringify(await res.socket.connection.getWorldByIdMulti(...(new Array(getCount(req.query))).fill(0).map(e => [getRandom()]))))
    }, { qs: true })
    .get('/db2', async (req, res) => {
      res.json(sDB(await res.socket.connection.getWorldById(getRandom())))
    })
    .get('/query3', async (req, res) => {
      const { getWorldById } = res.socket.connection
      const count = getCount(req.query)
      const worlds = []
      for (let i = 0; i < count; i++) {
        worlds.push(getWorldById(getRandom()))
      }
      res.json(JSON.stringify(await Promise.all(worlds)))
    }, { qs: true })
    .get('/query2', async (req, res) => {
      const fn = () => res.socket.connection.getWorldById(getRandom())
      res.json(`[${(await Promise.all(createArray(getCount(req.query), fn))).map(sDB).join(',')}]`)
    }, { qs: true })
    .connect(sock => {
      sock.connection = connections[sock.fd % poolSize]
    })
    .listen(port, address)
  server.name = 'j'
  server.stackTraces = true
}

main().catch(err => just.error(err.stack))
