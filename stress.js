const { createClient } = require('redis.js')

const clients = []

function newClient () {
  const client = createClient()
  client.connect(() => {
    function next () {
      //client.get(Math.floor((Math.random() * 10000)).toString(), next)
      client.put(Math.floor((Math.random() * 10000)).toString(), '0'.repeat(4096), next)
    }
    next()
  })
  return client
}

clients.push(newClient())
clients.push(newClient())
clients.push(newClient())
clients.push(newClient())
clients.push(newClient())
clients.push(newClient())
clients.push(newClient())
clients.push(newClient())

just.setInterval(() => {
  let recv = 0
  let send = 0
  for (const client of clients) {
    recv += client.recv
    send += client.send
    client.send = client.recv = 0
  }
  just.print(`recv ${Math.floor(recv * 100 * 8 / (1024 * 1024 * 1024)) / 100} send ${Math.floor(send * 100 * 8 / (1024 * 1024 * 1024)) / 100}`)
}, 1000)
