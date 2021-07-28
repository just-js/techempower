const stringify = require('@stringify')
const justify = require('@justify')
const postgres = require('pg.js')
const util = require('util.js')

const config = require('techempower.config.js')

const { createPool, createBatch } = postgres
const { createServer } = justify
const { sjs, attr } = stringify
const { maxRandom, maxQuery, server, queries, db } = config
const { port, address } = server
const { spray } = util
const { worlds } = queries

const poolSize = parseInt(just.env().PGPOOL || just.sys.cpus, 10)

const getRandom = () => Math.ceil(Math.random() * maxRandom)
const getCount = qs => Math.min(parseInt((qs.q) || 1, 10), maxQuery) || 1
const jsonify = sjs({ id: attr('number'), randomnumber: attr('number') })

async function main () {
  async function onConnect (sock) {
    const batch = await createBatch(sock, worlds, maxQuery)
    sock.getWorldById = (...args) => batch.run(args)
  }
  const pool = await createPool(db, poolSize, onConnect)
  const server = createServer()
    .get('/db', async (req, res) => {
      const { getWorldById } = res.socket.db
      res.json(jsonify(await getWorldById(getRandom())))
    })
    .get('/query', async (req, res) => {
      const { getWorldById } = res.socket.db
      const count = getCount(req.query)
      if (count === 1) {
        res.json(jsonify(await getWorldById(getRandom())))
        return
      }
      const args = spray(getCount(req.query), getRandom)
      res.json(`[${(await getWorldById(...args)).map(jsonify).join(',')}]`)
    }, { qs: true })
    .connect(sock => {
      sock.db = pool[sock.fd % poolSize]
    })
    .listen(port, address)
  server.name = 'j'
}

main().catch(err => just.error(err.stack))
