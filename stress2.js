const { createClient } = require('redis.js')

const clients = []

function newClient () {
  const client = createClient()
  client.connect(() => {
    client.put('hello', '0'.repeat(64), message => {
      just.print('put ok')
      just.print(JSON.stringify(message))
    })
    client.put('hello2', '1'.repeat(8), message => {
      just.print('put ok')
      just.print(JSON.stringify(message))
    })
    client.get('hello', message => {
      just.print('get ok')
      just.print(JSON.stringify(message))
    })
    client.get('hello2', message => {
      just.print('get ok')
      just.print(JSON.stringify(message))
    })
  })
  return client
}

clients.push(newClient())
clients.push(newClient())

just.setInterval(() => {
  just.print(clients.map(c => `recv ${c.recv} send ${c.send}`).join('\n'))
  clients.forEach(c => {
    c.recv = c.send = 0
  })
}, 1000)
