const db = {
  hostname: 'tfb-database',
  port: 5432,
  user: 'benchmarkdbuser',
  pass: 'benchmarkdbpass',
  database: 'hello_world'
}

const server = {
  address: '0.0.0.0',
  port: 8080
}

const templates = {
  fortunes: 'fortunes.html',
  fortunes2: 'fortunes2.html',
  settings: { rawStrings: false, compile: true }
}

const maxRandom = 10000
const maxQuery = 10

module.exports = { db, server, maxRandom, maxQuery, templates }
