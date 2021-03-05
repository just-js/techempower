const { launch, watch } = just.process
const { readStat } = require('lib/monitor.js')

const { STDOUT_FILENO, STDERR_FILENO } = just.sys

async function main (args) {
  const cpus = parseInt(just.env().CPUS || just.sys.cpus, 10)
  const pids = []
  const processes = []
  const path = just.sys.cwd()
  for (let i = 0; i < cpus; i++) {
    const process = launch('just', args, path)
    process.onStdout = (buf, len) => just.net.write(STDOUT_FILENO, buf, len)
    process.onStderr = (buf, len) => just.net.write(STDERR_FILENO, buf, len)
    pids.push(process.pid)
    processes.push(watch(process))
  }
  const last = { user: 0, system: 0 }
  just.setInterval(() => {
    const stat = { user: 0, system: 0, rss: 0 }
    for (const pid of pids) {
      const { utime, stime, rssPages } = readStat(pid)
      const rss = Math.floor((rssPages * just.sys.pageSize) / (1024 * 1024))
      stat.rss += rss
      stat.user += utime
      stat.system += stime
    }
    const user = stat.user - last.user
    const system = stat.system - last.system
    last.user = stat.user
    last.system = stat.system
    just.print(`children ${pids.length} rss ${stat.rss} user ${user} system ${system} total ${user + system}`)
  }, 1000)
  await Promise.all(processes)
}

main(just.args.slice(2)).catch(err => just.error(err.stack))
