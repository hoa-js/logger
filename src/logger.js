/**
 * Logger middleware for Hoa.
 *
 * Logs incoming requests and outgoing responses with method, path, status, and elapsed time.
 *
 * @param {(str: string, ...rest: string[]) => void} [fn=console.log] Optional printer for customized logging behavior.
 * @returns {(ctx: import('hoa').HoaContext, next: () => Promise<void>) => Promise<void>} Hoa middleware.
 */

const LogPrefix = {
  Outgoing: '-->',
  Incoming: '<--',
  Error: 'xxx'
}

const humanize = (times) => {
  const [delimiter, separator] = [',', '.']
  const orderTimes = times.map((v) => v.replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + delimiter))
  return orderTimes.join(separator)
}

const time = (start) => {
  const delta = Date.now() - start
  return humanize([delta < 1000 ? delta + 'ms' : Math.round(delta / 1000) + 's'])
}

function isColorEnabled () {
  try {
    const g = globalThis
    const env = g?.process?.env
    const tty = g?.process?.stdout?.isTTY
    if (env?.FORCE_COLOR === '0') return false
    if (env?.NO_COLOR) return false
    if (env?.FORCE_COLOR) return true
    return Boolean(tty)
  } catch {
    return false
  }
}

const colorStatus = (status) => {
  if (isColorEnabled()) {
    switch ((status / 100) | 0) {
      case 5:
        return `\x1b[31m${status}\x1b[0m`
      case 4:
        return `\x1b[33m${status}\x1b[0m`
      case 3:
        return `\x1b[36m${status}\x1b[0m`
      case 2:
        return `\x1b[32m${status}\x1b[0m`
    }
  }
  return `${status}`
}

function log (
  fn,
  prefix,
  method,
  path,
  status = 0,
  elapsed
) {
  const out =
    prefix === LogPrefix.Incoming
      ? `${prefix} ${method} ${path}`
      : `${prefix} ${method} ${path} ${colorStatus(status)} ${elapsed}`
  fn(out)
}

export function logger (fn = console.log) {
  return async function hoaLogger (ctx, next) {
    const method = ctx.req.method
    const path = ctx.req.pathname + ctx.req.search

    log(fn, LogPrefix.Incoming, method, path)
    const start = Date.now()

    try {
      await next()
      log(fn, LogPrefix.Outgoing, method, path, ctx.res.status, time(start))
    } catch (err) {
      log(fn, LogPrefix.Error, method, path, err?.status ?? err?.statusCode ?? 500, time(start))
      throw err
    }
  }
}

export default logger
