const stringify = require('@stringify')
const justify = require('@justify')
const postgres = require('pg.js')
const util = require('util.js')
const html = require('@html')

const config = require('techempower.config.js')

const { createPool, createBatch, generateBulkUpdate } = postgres
const { createServer } = justify
const { sjs, attr } = stringify
const { maxRandom, maxQuery, server, queries, db, templates } = config
const { port, address } = server
const { spray } = util

function sortByMessage (a, b) {
  if (a.message > b.message) return 1
  if (a.message < b.message) return -1
  return 0
}

async function setup (sock) {
  const { worlds, fortunes } = queries

  const fortunesBatch = createBatch(sock, fortunes, maxQuery)
  fortunesBatch.compile(fortunesBatch.generate())
  sock.getAllFortunes = () => fortunesBatch.run()

  const worldsBatch = createBatch(sock, worlds, maxQuery)
  worldsBatch.compile(worldsBatch.generate())
  sock.getWorldById = (...args) => worldsBatch.run(args)

  await fortunesBatch.create()
  await worldsBatch.create()

  const promises = []
  for (let i = 0; i < maxQuery * 2; i++) {
    const update = Object.assign(Object.assign({}, queries.update), generateBulkUpdate('world', 'randomnumber', 'id', i + 1))
    update.name = `${update.name}.${i + 1}`
    const updatesBatch = createBatch(sock, update, maxQuery)
    updatesBatch.compile(updatesBatch.generate())
    sock.updateBulk = (args) => {
      const update = updates[args.length]
      return update.run([args])
    }
    promises.push(updatesBatch.create())
  }
  const updates = await Promise.all(promises)
  updates.unshift({ run: () => Promise.resolve([]) })
}

const getRandom = () => Math.ceil(Math.random() * maxRandom)
const getCount = qs => Math.min(parseInt(((qs || {}).q) || 1, 10), maxQuery) || 1

const poolSize = parseInt(just.env().PGPOOL || just.sys.cpus, 10)
const extra = { id: 0, message: 'Additional fortune added at request time.' }
const jsonify = sjs({ id: attr('number'), randomnumber: attr('number') })
const sJSON = sjs({ message: attr('string') })
const message = 'Hello, World!'
const json = { message }
const fortunes = html.load(templates.fortunes, templates.settings)

async function main () {
  const pool = await createPool(db, poolSize)
  await Promise.all(pool.map(sock => setup(sock)))
  //const timer = util.monitor(pool)

  const server = createServer()
    .get('/update', async (req, res) => {
      const { getWorldById, updateBulk } = res.socket.db
      const count = getCount(req.query)
      if (count === 1) {
        const world = await getWorldById(getRandom())
        await updateBulk(([world].flatMap(r => [r.id, r.randomnumber])))
        res.json(jsonify([world]))
        return
      }
      const args = spray(count, getRandom)
      const records = await getWorldById(...args)
      await updateBulk(records.flatMap(r => [r.id, r.randomnumber]))
      res.json(`[${records.map(jsonify).join(',')}]`)
    }, { qs: true })
    .get('/db', async (req, res) => {
      const { getWorldById } = res.socket.db
      res.json(jsonify(await getWorldById(getRandom())))
    })
    .get('/fortunes', async (req, res) => {
      const { getAllFortunes } = res.socket.db
      res.html(fortunes.call([extra, ...(await getAllFortunes())].sort(sortByMessage)))
    })
    .get('/query', async (req, res) => {
      const { getWorldById } = res.socket.db
      const count = getCount(req.query)
      if (count === 1) {
        res.json(jsonify(await getWorldById(getRandom())))
        return
      }
      const args = spray(count, getRandom)
      res.json(`[${(await getWorldById(...args)).map(jsonify).join(',')}]`)
    }, { qs: true })
    .connect(sock => {
      sock.db = pool[sock.fd % poolSize]
    })
    .get('/json', (req, res) => res.json(sJSON(json)))
    .get('/plaintext', (req, res) => res.text(message))
    .listen(port, address)

  server.name = 'j'
  server.stackTraces = config.stackTraces
}

main().catch(err => just.error(err.stack))
