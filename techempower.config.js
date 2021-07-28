const postgres = require('pg.js')

const { BinaryInt } = postgres.constants

const db = {
  hostname: 'tfb-database',
  port: 5432,
  user: 'benchmarkdbuser',
  pass: 'benchmarkdbpass',
  database: 'hello_world',
  bufferSize: 64 * 1024,
  version: 0x00030000
}

const server = {
  address: '0.0.0.0',
  port: 8080
}

const templates = {
  fortunes: 'fortunes.html',
  settings: { rawStrings: false, compile: true }
}

const queries = {
  worlds: {
    name: 's1',
    portal: '',
    sql: 'select id, randomNumber from World where id = $1',
    fields: [BinaryInt],
    formats: [BinaryInt],
    params: [1],
    maxRows: 100
  }
}

const maxRandom = 10000
const maxQuery = 20

module.exports = { db, server, maxRandom, maxQuery, templates, queries }
