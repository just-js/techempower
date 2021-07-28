const stringify = require('@stringify')
const justify = require('@justify')
const postgres = require('pg.js')
const { spray } = require('util.js')

const config = require('techempower.config.js')

const { createPool, createBatch } = postgres
const { createServer } = justify
const { sjs, attr } = stringify
const { maxRandom, maxQuery } = config
const { port, address } = config.server

const getRandom = () => Math.ceil(Math.random() * maxRandom)
const getCount = qs => Math.min(parseInt((qs.q) || 1, 10), maxQuery) || 1

async function main () {
  const jsonify = sjs({ id: attr('number'), randomnumber: attr('number') })
  const poolSize = parseInt(just.env().PGPOOL || just.sys.cpus, 10)
  const { worlds } = config.queries
  const connections = await createPool(config.db, poolSize, async sock => {
    const batch = await createBatch(sock, worlds, maxQuery)
    sock.getWorldById = (...args) => batch.run(args)
    return sock.getWorldById
  })
  const server = createServer()
    .get('/db', async (req, res) => {
      const { getWorldById } = res.socket.connection
      res.json(jsonify(await getWorldById(getRandom())))
    })
    .get('/query', async (req, res) => {
      const { getWorldById } = res.socket.connection
      const count = getCount(req.query)
      if (count === 1) {
        res.json(jsonify(await getWorldById(getRandom())))
        return
      }
      const args = spray(getCount(req.query), getRandom)
      res.json(`[${(await getWorldById(...args)).map(jsonify).join(',')}]`)
    }, { qs: true })
    .connect(sock => {
      sock.connection = connections[sock.fd % poolSize]
    })
    .listen(port, address)
  server.name = 'j'
  server.stackTraces = true
}

main().catch(err => just.error(err.stack))
