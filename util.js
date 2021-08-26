const cache = require('@cache')
const postgres = require('@pg')

const config = require('tfb.config.js')

const { SimpleCache } = cache
const { maxRandom, maxQuery, queries } = config
const { connect, generateBulkUpdate } = postgres

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
  max += 1
  return (n, fn) => ar[n % max].map(fn)
}

/**
 * Utility function to do insertion sort (faster for small arrays) on
 * list of fortunes by message field
 * @param {Array} arr    - Array of fortunes to sort. each member has id and message fields
 */
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

/**
 * Utility function to get a random number from 1 to maxRandom (from config)
 */
const getRandom = () => Math.ceil(Math.random() * maxRandom)

/**
 * Utility function to get the count from the querystring according to techempower rules
 * @param {Object} qs - optional object with field q = count
 */
const getCount = (qs = { q: 1 }) => (Math.min(parseInt((qs.q) || 1, 10), maxQuery) || 1)

/**
 * Utility function which will create an array filled with n results of a function passed
 * @param {Number} n - number of items in array
 * @param {Function} fn - the function which will provide each member of the array
 */
const spray = sprayer(maxQuery)

/**
 * Set up the compiled/prepared queries on the pg connection and wrap them up
 * in a simple api
 * @param {Object} sock - postgres socket from pg.connect
 */
async function setupConnection (sock) {
  const { worlds, fortunes } = queries
  const updates = [{ run: () => Promise.resolve([]) }]
  const fortunesQuery = await sock.compile(fortunes, 2048)
  const worldsQuery = await sock.compile(worlds, 2048)
  function getWorldById (id) {
    worldsQuery.query.params[0] = id
    return worldsQuery.runSingle()
  }
  sock.getWorldById = getWorldById
  sock.getAllFortunes = () => fortunesQuery.runSingle()
  sock.getWorldsById = ids => worldsQuery.runBatch(ids)
  const worldCache = new SimpleCache(id => sock.getWorldById(id)).start()
  worldCache.getRandom = () => worldCache.get(getRandom())
  sock.worldCache = worldCache
  sock.updateWorlds = async (worlds, count) => {
    let updateWorlds = updates[count]
    if (!updateWorlds) {
      const update = generateBulkUpdate('world', 'randomnumber', 'id', count)
      const bulk = Object.assign(queries.update, update)
      updateWorlds = sock.compile(bulk)
      updates[count] = updateWorlds
      await updateWorlds
    }
    if (!updateWorlds.query) {
      updateWorlds = await updateWorlds
    }
    let i = 0
    for (const world of worlds) {
      world.randomnumber = getRandom()
      updateWorlds.query.params[i++] = world.id
      updateWorlds.query.params[i++] = world.randomnumber
    }
    return updateWorlds.runSingleCommit()
  }
  return sock
}

/**
 * connect to database and set up connections
 * @param {Object} db - database configuration
 */
async function setup (db) {
  const sock = (await connect(db, 1))[0]
  await (setupConnection(sock))
  return sock
}

/**
 * dump cpu and memory usage stats
 * @param {Object} db - database configuration
 */
function monitor (threads) {
  if (!threads) return
  return just.setInterval(() => {
    if (!just.env().MONITOR) return
    const { user, system } = just.cpuUsage()
    const { rss } = just.memoryUsage()
    const totalMem = Math.floor(Number(rss) / (1024 * 1024))
    const memPerThread = Math.floor((totalMem / threads.length) * 100) / 100
    just.print(`threads ${threads.length} mem ${totalMem} MB / ${memPerThread} MB cpu (${user.toFixed(2)}/${system.toFixed(2)}) ${(user + system).toFixed(2)}`)
  }, 1000)
}

module.exports = {
  getRandom,
  getCount,
  setup,
  spray,
  sortByMessage,
  monitor
}
