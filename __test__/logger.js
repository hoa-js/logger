import Hoa from 'hoa'
import { logger } from '../src/logger.js'

function sleep (ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

function capturePrinter () {
  const logs = []
  return { logs, print: (str) => logs.push(str) }
}

function createApp (print) {
  const app = new Hoa()
  app.use(logger(print))

  app.use(async (ctx, next) => {
    const pathname = ctx.req.pathname

    if (pathname === '/fast') { await sleep(10); ctx.res.body = 'fast'; return }
    if (pathname === '/slow') { await sleep(30); ctx.res.body = 'slow'; return }
    if (pathname === '/very-slow') { await sleep(1100); ctx.res.body = 'very-slow'; return }
    if (pathname === '/error') { ctx.throw(400, 'Bad Request') }
    if (pathname === '/empty') { ctx.res.body = ''; return }
    if (pathname === '/redirect') { ctx.res.status = 301; ctx.res.set('Location', '/empty'); return }

    await next()
  })

  return app
}

describe('Logger Middleware for Hoa', () => {
  it('should log incoming and outgoing for fast path', async () => {
    const { logs, print } = capturePrinter()
    const app = createApp(print)

    const res = await app.fetch(new Request('http://localhost/fast'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('fast')

    expect(logs.length).toBe(2)
    expect(logs[0]).toMatch(/^<-- GET \/fast$/)
    expect(logs[1]).toMatch(/^--> GET \/fast (?:\x1b\[[0-9;]*m)?2\d\d(?:\x1b\[[0-9;]*m)? \d+(?:ms|s)$/)
  })

  it('should log incoming and outgoing for slow path', async () => {
    const { logs, print } = capturePrinter()
    const app = createApp(print)

    const res = await app.fetch(new Request('http://localhost/slow'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('slow')

    expect(logs.length).toBe(2)
    expect(logs[0]).toMatch(/^<-- GET \/slow$/)
    expect(logs[1]).toMatch(/^--> GET \/slow (?:\x1b\[[0-9;]*m)?2\d\d(?:\x1b\[[0-9;]*m)? \d+(?:ms|s)$/)
  })

  it('should include query string in path', async () => {
    const { logs, print } = capturePrinter()
    const app = createApp(print)

    const res = await app.fetch(new Request('http://localhost/fast?foo=bar'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('fast')

    expect(logs.length).toBe(2)
    expect(logs[0]).toMatch(/^<-- GET \/fast\?foo=bar$/)
    expect(logs[1]).toMatch(/^--> GET \/fast\?foo=bar (?:\x1b\[[0-9;]*m)?2\d\d(?:\x1b\[[0-9;]*m)? \d+(?:ms|s)$/)
  })

  it('should log incoming and error when downstream throws', async () => {
    const { logs, print } = capturePrinter()
    const app = createApp(print)

    const res = await app.fetch(new Request('http://localhost/error'))
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('Bad Request')

    expect(logs.length).toBe(2)
    expect(logs[0]).toMatch(/^<-- GET \/error$/)
    expect(logs[1]).toMatch(/^xxx GET \/error (?:\x1b\[[0-9;]*m)?4\d\d(?:\x1b\[[0-9;]*m)? \d+(?:ms|s)$/)
  })

  it('should log redirect status 301', async () => {
    const { logs, print } = capturePrinter()
    const app = createApp(print)

    const res = await app.fetch(new Request('http://localhost/redirect'))
    expect(res.status).toBe(301)

    expect(logs.length).toBe(2)
    expect(logs[0]).toMatch(/^<-- GET \/redirect$/)
    expect(logs[1]).toMatch(/^--> GET \/redirect (?:\x1b\[[0-9;]*m)?3\d\d(?:\x1b\[[0-9;]*m)? \d+(?:ms|s)$/)
  })

  it('should respect NO_COLOR env (no ANSI)', async () => {
    const { logs } = capturePrinter()
    const print = (s) => logs.push(s)
    const app = new Hoa()

    const prev = process.env.NO_COLOR
    process.env.NO_COLOR = '1'
    try {
      app.use(logger(print))
      app.use(async (ctx) => { ctx.res.body = 'ok' })

      const res = await app.fetch(new Request('http://localhost/'))
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('ok')

      expect(logs.length).toBe(2)
      expect(/\x1b\[[0-9;]*m/.test(logs[1])).toBe(false)
      expect(logs[1]).toMatch(/^--> GET \/ 2\d\d \d+(?:ms|s)$/)
    } finally {
      if (prev == null) delete process.env.NO_COLOR
      else process.env.NO_COLOR = prev
    }
  })

  // FORCE_COLOR=0 branch: force disable color
  it('should respect FORCE_COLOR=0 (no ANSI even if tty)', async () => {
    const { logs } = capturePrinter()
    const print = (s) => logs.push(s)
    const app = new Hoa()

    const prev = process.env.FORCE_COLOR
    process.env.FORCE_COLOR = '0'
    try {
      app.use(logger(print))
      app.use(async (ctx) => { ctx.res.body = 'ok' })

      const res = await app.fetch(new Request('http://localhost/'))
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('ok')

      expect(logs.length).toBe(2)
      expect(/\x1b\[[0-9;]*m/.test(logs[1])).toBe(false)
      expect(logs[1]).toMatch(/^--> GET \/ 2\d\d \d+(?:ms|s)$/)
    } finally {
      if (prev == null) delete process.env.FORCE_COLOR
      else process.env.FORCE_COLOR = prev
    }
  })

  // FORCE_COLOR=1 branch: enable color
  it('should enable color when FORCE_COLOR is set', async () => {
    const { logs } = capturePrinter()
    const print = (s) => logs.push(s)
    const app = new Hoa()

    const prevFC = process.env.FORCE_COLOR
    const prevNC = process.env.NO_COLOR
    process.env.FORCE_COLOR = '1'
    delete process.env.NO_COLOR
    try {
      app.use(logger(print))
      app.use(async (ctx) => { ctx.res.body = 'ok' })

      const res = await app.fetch(new Request('http://localhost/'))
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('ok')

      expect(logs.length).toBe(2)
      expect(/\x1b\[[0-9;]*m/.test(logs[1])).toBe(true)
      expect(logs[1]).toMatch(/^--> GET \/ (?:\x1b\[[0-9;]*m)?2\d\d(?:\x1b\[[0-9;]*m)? \d+(?:ms|s)$/)
    } finally {
      if (prevFC == null) delete process.env.FORCE_COLOR
      else process.env.FORCE_COLOR = prevFC
      if (prevNC == null) delete process.env.NO_COLOR
      else process.env.NO_COLOR = prevNC
    }
  })

  // Cover elapsed time in seconds format (s)
  it('should format elapsed time in seconds when duration >= 1s', async () => {
    const { logs, print } = capturePrinter()
    const app = createApp(print)

    const res = await app.fetch(new Request('http://localhost/very-slow'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('very-slow')

    expect(logs.length).toBe(2)
    expect(logs[1]).toMatch(/^--> GET \/very-slow (?:\x1b\[[0-9;]*m)?2\d\d(?:\x1b\[[0-9;]*m)? \d+s$/)
  })

  // 5xx red status (when FORCE_COLOR=1)
  it('should color 5xx status red when color enabled', async () => {
    const { logs } = capturePrinter()
    const print = (s) => logs.push(s)
    const app = new Hoa()

    const prevFC = process.env.FORCE_COLOR
    const prevNC = process.env.NO_COLOR
    process.env.FORCE_COLOR = '1'
    delete process.env.NO_COLOR
    try {
      app.use(logger(print))
      app.use(async (ctx) => { if (ctx.req.pathname === '/') ctx.throw(500, 'Internal Error') })

      const res = await app.fetch(new Request('http://localhost/'))
      expect(res.status).toBe(500)
      // Hoa does not expose custom message for 5xx; response uses standard text
      expect(await res.text()).toBe('Internal Server Error')

      expect(logs.length).toBe(2)
      expect(logs[0]).toMatch(/^<-- GET \/$/)
      expect(logs[1]).toMatch(/^xxx GET \/ \x1b\[31m5\d\d\x1b\[0m \d+(?:ms|s)$/)
    } finally {
      if (prevFC == null) delete process.env.FORCE_COLOR
      else process.env.FORCE_COLOR = prevFC
      if (prevNC == null) delete process.env.NO_COLOR
      else process.env.NO_COLOR = prevNC
    }
  })

  // err.statusCode branch coverage
  it('should log error statusCode when error has no status', async () => {
    const { logs } = capturePrinter()
    const print = (s) => logs.push(s)
    const app = new Hoa()

    app.use(logger(print))
    app.use(async (ctx) => {
      if (ctx.req.pathname === '/err-statuscode') {
        const e = new Error('Bad Gateway')
        e.statusCode = 502
        e.expose = true
        throw e
      } else {
        ctx.res.body = 'ok'
      }
    })

    const res = await app.fetch(new Request('http://localhost/err-statuscode'))
    expect(res.status).toBe(502)
    expect(await res.text()).toBe('Bad Gateway')

    expect(logs.length).toBe(2)
    expect(logs[0]).toMatch(/^<-- GET \/err-statuscode$/)
    expect(logs[1]).toMatch(/^xxx GET \/err-statuscode (?:\x1b\[[0-9;]*m)?5\d\d(?:\x1b\[[0-9;]*m)? \d+(?:ms|s)$/)
  })

  // 500 fallback branch coverage (no status/statusCode)
  it('should log fallback 500 when error has neither status nor statusCode', async () => {
    const { logs } = capturePrinter()
    const print = (s) => logs.push(s)
    const app = new Hoa()

    app.use(logger(print))
    app.use(async (ctx) => {
      if (ctx.req.pathname === '/err-plain') {
        throw new Error('oops')
      } else {
        ctx.res.body = 'ok'
      }
    })

    const res = await app.fetch(new Request('http://localhost/err-plain'))
    expect(res.status).toBe(500)
    expect(await res.text()).toBe('Internal Server Error')

    expect(logs.length).toBe(2)
    expect(logs[0]).toMatch(/^<-- GET \/err-plain$/)
    expect(logs[1]).toMatch(/^xxx GET \/err-plain (?:\x1b\[[0-9;]*m)?500(?:\x1b\[[0-9;]*m)? \d+(?:ms|s)$/)
  })

  // Default printer (console.log) branch coverage
  it('should use default console.log printer when not provided', async () => {
    const app = new Hoa()

    const calls = []
    const originalLog = console.log
    console.log = (str) => { calls.push(str) }
    try {
      app.use(logger())
      app.use(async (ctx) => { ctx.res.body = 'ok' })

      const res = await app.fetch(new Request('http://localhost/'))
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('ok')

      expect(calls.length).toBe(2)
      expect(calls[0]).toMatch(/^<-- GET \/$/)
      expect(calls[1]).toMatch(/^--> GET \/ (?:\x1b\[[0-9;]*m)?2\d\d(?:\x1b\[[0-9;]*m)? \d+(?:ms|s)$/)
    } finally {
      console.log = originalLog
    }
  })
  it('should handle exceptions in color detection (catch path)', async () => {
    const { logs } = capturePrinter()
    const print = (s) => logs.push(s)
    const app = new Hoa()

    const prevDesc = Object.getOwnPropertyDescriptor(globalThis, 'process')
    try {
      Object.defineProperty(globalThis, 'process', {
        configurable: true,
        get () { throw new Error('boom') }
      })

      app.use(logger(print))
      app.use((ctx) => { ctx.res.status = 200; ctx.res.body = 'ok' })

      const res = await app.fetch(new Request('http://localhost/'))
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('ok')

      expect(logs.length).toBe(2)
      // No ANSI color output
      expect(logs[1]).toMatch(/^--> GET \/ 200 \d+(?:ms|s)$/)
    } finally {
      if (prevDesc) Object.defineProperty(globalThis, 'process', prevDesc)
      else delete globalThis.process
    }
  })
})
