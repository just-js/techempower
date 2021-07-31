const stringify = require('@stringify')
const justify = require('@justify')
const postgres = require('pg.js')
const util = require('util.js')
const html = require('@html')

function sortByMessage (a, b) {
  if (a.message > b.message) return 1
  if (a.message < b.message) return -1
  return 0
}

async function setup (sock) {
  const { worlds, fortunes } = queries
  const updates = [{ run: () => Promise.resolve([]) }]
  // compile the queries
  const fortunesQuery = await sock.createQuery(fortunes, maxQuery).setup().generate().compile().create()
  const worldsQuery = await sock.createQuery(worlds, maxQuery).setup().generate().compile().create()
  // compile a query for each bulk update
  for (let i = 1; i <= maxQuery; i++) {
    const update = generateBulkUpdate('world', 'randomnumber', 'id', i)
    const bulk = Object.assign(queries.update, update)
    updates.push(await sock.createQuery(bulk).setup().generate().compile().create())
    just.print(`${ANSI.control.move(5, 0)}batches compiled ${ANSI.control.column(30)}${AY}${i}${AD}${ANSI.control.move(1, 30)}`)
  }
  // create our api
  sock.getAllFortunes = (...args) => fortunesQuery.run(...args)
  sock.getWorldById = id => worldsQuery.run([id])
  sock.getWorldByIdMulti = args => worldsQuery.run(args)
  sock.updateWorld = (args) => updates[Math.ceil(args.length / 2)].run([args])
  sock.updateWorlds = (args) => updates[Math.ceil(args.length / 2)].run([args])
}

const getRandom = () => Math.ceil(Math.random() * maxRandom)
const getCount = qs => Math.min(parseInt(((qs || {}).q) || 1, 10), maxQuery) || 1

const config = require('techempower.config.js')

const { connect } = postgres
const { createServer } = justify
const { sjs, attr } = stringify
const { maxRandom, maxQuery, server, queries, db, templates } = config
const { port, address } = server
const { log, spray, generateBulkUpdate } = util
const { ANSI } = require('@binary')

const poolSize = parseInt(just.env().PGPOOL || just.sys.cpus, 10)
const extra = { id: 0, message: 'Additional fortune added at request time.' }
const jsonify = sjs({ id: attr('number'), randomnumber: attr('number') })
const sJSON = sjs({ message: attr('string') })
const message = 'Hello, World!'
const json = { message }
const template = html.load(templates.fortunes, templates.settings)

const { AD, AG, AY, AR } = ANSI

async function main (args) {
  log.first('creating connection pool')
  const pool = await connect(db, poolSize)
  log.after('setting up connections')
  await Promise.all(pool.map(sock => setup(sock)))
  // todo: don't pass req and res. put them on this
  /*
  .get('/foo', () => this.res.text('hello'))
  */
  const server = createServer()
    .get('/update', async (req, res) => {
      const { getWorldById, updateBulk } = res.socket.db
      const count = getCount(req.query)
      if (count === 1) {
        const world = await getWorldById(getRandom())
        world.randomnumber = getRandom()
        await updateBulk(([world].flatMap(w => [w.id, w.randomnumber])))
        res.json(jsonify(world))
        return
      }
      const records = await getWorldById(...spray(count, getRandom))
      await updateBulk(records.flatMap(r => [r.id, getRandom()]))
      res.json(`[${records.map(jsonify).join(',')}]`)
    }, { qs: true })
    .get('/db', async (req, res) => {
      const { getWorldById } = res.socket.db
      res.json(jsonify(await getWorldById(getRandom())))
    })
    .get('/fortunes', async (req, res) => {
      const { getAllFortunes } = res.socket.db
      const fortunes = await getAllFortunes()
      res.html(template.call([extra, ...fortunes].sort(sortByMessage)))
    })
    .get('/query', async (req, res) => {
      const { getWorldByIdMulti, getWorldById } = res.socket.db
      const count = getCount(req.query)
      if (count === 1) {
        res.json(jsonify((await getWorldById(getRandom()))))
        return
      }
      const worlds = await getWorldByIdMulti(spray(count, getRandom))
      res.json(`[${worlds.map(jsonify).join(',')}]`)
    }, { qs: true })
    .connect(sock => {
      sock.db = pool[sock.fd % poolSize]
    })
    .get('/json', (req, res) => res.json(sJSON(json)))
    .get('/plaintext', (req, res) => res.text(message))
    .get(/\/world\/(.+)\/?/, async (req, res) => {
      const [id] = req.params
      if (!id) return server.notFound(req, res)
      res.json(jsonify((await res.socket.db.getWorldById(id))))
    }, { query: true })
    .use((req, res) => server.stats.rps++, true)
    .listen(port, address)
  server.stats = { rps: 0 }
  server.name = config.server.name
  server.stackTraces = config.stackTraces
  log.only(`server ${server.name} listening on ${ANSI.control.column(30)}${AG}${address}${AD}:${AY}${port}${AD}`)
  log.only(`stacktrackes: ${ANSI.control.column(30)}${server.stacktraces ? `${AG}on${AD}` : `${AR}off${AD}`}`)
  util.monitor(pool, server.stats)
}

main(just.args.slice(2)).catch(err => just.error(err.stack))
