const postgres = require('@pg')

const { BinaryInt, VarChar } = postgres.constants

const db = {
  hostname: 'tfb-database',
  user: 'benchmarkdbuser',
  pass: 'benchmarkdbpass',
  database: 'hello_world',
  bufferSize: 64 * 1024,
  noDelay: false,
  poolSize: 1
}

const httpd = {
  address: '0.0.0.0',
  port: 8080,
  name: 'j',
  stackTraces: false
}

const templates = {
  fortunes: 'fortunes.html',
  settings: { rawStrings: false, compile: true }
}

const queries = {
  update: {
    name: 'A'
  },
  worlds: {
    name: '',
    sql: 'select id, randomNumber from World where id = $1',
    fields: [
      { format: BinaryInt, name: 'id' },
      { format: BinaryInt, name: 'randomnumber' }
    ],
    params: 1,
    formats: [BinaryInt]
  },
  fortunes: {
    name: 'C',
    sql: 'select * from Fortune',
    fields: [
      { format: BinaryInt, name: 'id' },
      { format: VarChar, name: 'message', htmlEscape: true }
    ]
  }
}

const maxRandom = 10000
const maxQuery = 500

module.exports = { db, httpd, maxRandom, maxQuery, templates, queries }
