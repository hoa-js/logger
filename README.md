## @hoajs/logger

Logger middleware for Hoa.

## Installation

```bash
$ npm i @hoajs/logger --save
```

## Quick Start

```js
import { Hoa } from 'hoa'
import { logger } from '@hoajs/logger'

const app = new Hoa()
app.use(logger())

app.use(async (ctx) => {
  ctx.res.body = 'Hello, Hoa!'
})

export default app
```

## Documentation

The documentation is available on [hoa-js.com](https://hoa-js.com/middleware/logger.html)

## Test (100% coverage)

```sh
$ npm test
```

## License

MIT
