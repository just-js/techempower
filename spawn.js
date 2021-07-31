const { launch, watch } = just.process
const { STDOUT_FILENO, STDERR_FILENO } = just.sys
const { net, fs } = just

function readStat (pid) {
  const buf = new ArrayBuffer(4096)
  const path = `/proc/${pid}/stat`
  const fd = fs.open(path)
  net.seek(fd, 0, net.SEEK_SET)
  const { byteLength } = buf
  let bytes = net.read(fd, buf, 0, byteLength)
  const parts = []
  while (bytes > 0) {
    parts.push(buf.readString(bytes))
    bytes = net.read(fd, buf, 0, byteLength)
  }
  const fields = parts.join('').split(' ')
  const comm = fields[1]
  const state = fields[2]
  const [
    ppid,
    pgrp,
    session,
    ttyNr,
    tpgid,
    flags,
    minflt,
    cminflt,
    majflt,
    cmajflt,
    utime,
    stime,
    cutime,
    cstime,
    priority,
    nice,
    numThreads,
    itrealvalue,
    starttime,
    vsize,
    rssPages,
    rsslim,
    startcode,
    endcode,
    startstack,
    kstkesp,
    kstkeip,
    signal,
    blocked,
    sigignore,
    sigcatch,
    wchan,
    nswap,
    cnswap,
    exitSignal,
    processor,
    rtPriority,
    policy,
    delayacctBlkioTicks,
    guestTime,
    cguestTime,
    startData,
    endData,
    startBrk,
    argStart,
    argEnd,
    envStart,
    envEnd,
    exitCode
  ] = fields.slice(3).map(v => Number(v))
  net.close(fd)
  return {
    pid,
    comm,
    state,
    ppid,
    pgrp,
    session,
    ttyNr,
    tpgid,
    flags,
    minflt,
    cminflt,
    majflt,
    cmajflt,
    utime,
    stime,
    cutime,
    cstime,
    priority,
    nice,
    numThreads,
    itrealvalue,
    starttime,
    vsize,
    rssPages,
    rsslim,
    startcode,
    endcode,
    startstack,
    kstkesp,
    kstkeip,
    signal,
    blocked,
    sigignore,
    sigcatch,
    wchan,
    nswap,
    cnswap,
    exitSignal,
    processor,
    rtPriority,
    policy,
    delayacctBlkioTicks,
    guestTime,
    cguestTime,
    startData,
    endData,
    startBrk,
    argStart,
    argEnd,
    envStart,
    envEnd,
    exitCode
  }
}

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
