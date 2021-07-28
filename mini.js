const stringify = require('@stringify')
const justify = require('@justify')
const postgres = require('pg.js')

const config = require('techempower.config.js')

const { createPool, compile, createBatchMessages } = postgres
const { createServer } = justify
const { sjs, attr } = stringify
const { maxRandom, maxQuery } = config
const { port, address } = config.server

const ar = {}
for (let i = 1; i < 100; i++) {
  ar[i] = (new Array(i)).fill(1)
}

const getRandom = () => Math.ceil(Math.random() * maxRandom)
const getCount = qs => Math.min(parseInt((qs.q) || 1, 10), maxQuery) || 1
const spray = (count, fn) => ar[count].map(fn)
const comma = ','

async function onConnect (sock) {
  const { worlds } = config.queries
  const { name, sql, portal, formats, fields, params } = worlds
  sock.getWorldById = await compile(sock, name, sql, portal, formats, fields, params)
  sock.getWorldByIdMulti = createBatchMessages(10, worlds, sock)
}

async function main (args) {
  const sDB = sjs({ id: attr('number'), randomnumber: attr('number') })
  const poolSize = parseInt(just.env().PGPOOL || just.sys.cpus, 10)
  const connections = await createPool(config.db, poolSize, onConnect)
  const server = createServer()
    .get('/db', async (req, res) => {
      const { getWorldById } = res.socket.connection
      res.json(sDB(await getWorldById(getRandom())))
    })
    .get('/query', async (req, res) => {
      const { getWorldByIdMulti } = res.socket.connection
      res.json(`[${(await getWorldByIdMulti(...spray(getCount(req.query), getRandom))).map(sDB).join(comma)}]`)
    }, { qs: true })
    .connect(sock => {
      sock.connection = connections[sock.fd % poolSize]
    })
    .listen(port, address)
  server.name = 'j'
  server.stackTraces = true
}

main(just.args.slice(2)).catch(err => just.error(err.stack))
