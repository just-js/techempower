const sleep = ms => new Promise(ok => just.setTimeout(ok, ms))

async function main () {
  const p = await sleep(1000)
  just.print('one')
  await p
  just.print('two')
}

main().catch(err => just.print(err.stack))
