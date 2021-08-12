const { constants } = require('@pg')
const cache = require('@cache')
const { SimpleCache } = cache
const config = require('tfb.js')
const { readFile } = require('fs')
const threading = just.library('thread')
const { spawn } = threading.thread

/**
 * Utility function to generate an array of N values populated with provided
 * map function. There seems to be no simpler/quicker way to do this in JS.
 * @param {string} n     - Size of the array to create
 * @param {string} field - The map function which will create each array value
 */
function sprayer (max = 100) {
  const ar = [0]
  for (let i = 0; i < max; i++) {
    ar[i + 1] = (new Array(i + 1)).fill(1)
  }
  return (n, fn) => ar[n % (max + 1)].map(fn)
}

/**
 * Generate a Bulk Update SQL statement definition which can be passed to
 * sock.create. For a given table, identity column and column to be updated, it 
 * will generate a single SQL statement to update all fields in one statement
 *
 * @param {string} table   - The name of the table
 * @param {string} field   - The name of the field we want to update
 * @param {string} id      - The name of the id field
 * @param {string} updates - The number of rows to update in the statement
 * @param {string} type    - The name of the table
 */
function generateBulkUpdate (table, field, id, updates = 5, type = constants.BinaryInt) {
  function getIds (count) {
    const updates = []
    for (let i = 1; i < (count * 2); i += 2) {
      updates.push(`$${i}`)
    }
    return updates.join(',')
  }
  function getClauses (count) {
    const clauses = []
    for (let i = 1; i < (count * 2); i += 2) {
      clauses.push(`when $${i} then $${i + 1}`)
    }
    return clauses.join('\n')
  }
  const formats = [type]
  const sql = []
  sql.push(`update ${table} set ${field} = CASE ${id}`)
  sql.push(getClauses(updates))
  sql.push(`else ${field}`)
  sql.push(`end where ${id} in (${getIds(updates)})`)
  return { formats, name: `${updates}`, params: updates * 2, sql: sql.join('\n') }
}

function sortByMessage (arr) {
  const n = arr.length
  for (let i = 1; i < n; i++) {
    const c = arr[i]
    let j = i - 1
    while ((j > -1) && (c.message < arr[j].message)) {
      arr[j + 1] = arr[j]
      j--
    }
    arr[j + 1] = c
  }
  return arr
}

async function setupConnection (sock) {
  const { worlds, fortunes } = queries
  const updates = [{ run: () => Promise.resolve([]) }]
  const fortunesQuery = await sock.create(fortunes, 1)
  const worldsQuery = await sock.create(worlds, maxQuery)
  for (let i = 1; i <= maxQuery; i++) {
    const update = generateBulkUpdate('world', 'randomnumber', 'id', i)
    const bulk = Object.assign(queries.update, update)
    updates.push(await sock.create(bulk))
  }
  sock.getWorldById = id => {
    worldsQuery.query.params[0] = id
    return worldsQuery.runSingle()
  }
  sock.getAllFortunes = () => fortunesQuery.runSingle()
  sock.getWorldsById = ids => worldsQuery.runBatch(ids)
  sock.updates = updates
  const worldCache = new SimpleCache(id => sock.getWorldById(id)).start()
  worldCache.getRandom = () => worldCache.get(getRandom())
  sock.worldCache = worldCache
}

const { maxRandom, maxQuery, queries } = config
const getRandom = () => Math.ceil(Math.random() * maxRandom)
const getCount = (qs = { q: 1 }) => (Math.min(parseInt((qs.q) || 1, 10), maxQuery) || 1)
const spray = sprayer(maxQuery)

function threadify (main) {
  if (just.sys.tid() !== just.sys.pid()) {
    main().catch(err => just.error(err.stack))
    return
  }
  let source = just.builtin('techempower.js')
  if (!source) {
    source = readFile(just.args[1])
  }
  const cpus = parseInt(just.env().CPUS || just.sys.cpus, 10)
  for (let i = 0; i < cpus; i++) {
    const tid = spawn(source, just.builtin('just.js'), just.args)
    just.print(`thread ${tid} spawned`)
  }
  just.setInterval(() => {
    const { user, system } = just.cpuUsage()
    const { rss } = just.memoryUsage()
    const totalMem = Math.floor(Number(rss) / (1024 * 1024))
    const memPerThread = Math.floor(totalMem / cpus)
    just.print(`mem ${totalMem} / ${memPerThread} cpu (${user.toFixed(2)}/${system.toFixed(2)}) ${(user + system).toFixed(2)}`)
  }, 1000)
}

module.exports = { threadify, getRandom, getCount, setupConnection, spray, generateBulkUpdate, sortByMessage }
