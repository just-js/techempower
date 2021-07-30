const postgres = require('pg.js')

const { BinaryInt, VarChar } = postgres.constants

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
  update: {
    name: 'u1',
    portal: '',
    sql: '',
    fields: [],
    fieldNames: [],
    formats: [],
    params: [],
    maxRows: 100
  },
  worlds: {
    name: 's1',
    portal: '',
    sql: 'select id, randomNumber from World where id = $1',
    fields: [BinaryInt, BinaryInt],
    fieldNames: ['id', 'randomnumber'],
    formats: [BinaryInt],
    params: [1],
    maxRows: 100
  },
  fortunes: {
    name: 's2',
    portal: '',
    sql: 'select * from Fortune',
    fields: [BinaryInt, VarChar],
    fieldNames: ['id', 'message'],
    formats: [],
    params: [],
    maxRows: 100
  }
}

const maxRandom = 10000
const maxQuery = 500
const stackTraces = true

module.exports = { db, server, maxRandom, maxQuery, templates, queries, stackTraces }
