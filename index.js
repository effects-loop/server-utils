'use strict'

const Koa = require('koa')
const Router = require('@koa/router')
const bodyParser = require('koa-bodyparser')
const cors = require('@koa/cors')

const buildLogger = require('./initializers/logger')
const {
  errorFallback,
  addTracking,
  logInfo,
  setMaxRequestLoggingLen,
  setMaxResponseLoggingLen,
  handle404,
} = require('./lib/middleware')
const handleError = require('./lib/handleError')

const buildServer = ({
  name,
  log: providedLogger,
  logPath,
  routes = [],
  noLogging = false,
  allowCors = false,
  middleware = [],
  requestBodyMaxLoggingLen,
  responseBodyMaxLoggingLen,
  port,
  beforeStartup,
}) => {
  if (!providedLogger && name === undefined)
    throw new Error('Must provide a `name` argument if you do not provide a `log` argument.')
  const log = providedLogger || buildLogger({ name, logPath })
  const app = new Koa()

  app.use(errorFallback(log)) // Use first to catch all errors

  app.use(bodyParser()) // Use second so we can safely assume body is at least = to {}
  app.use(addTracking)
  if (!noLogging) app.use(logInfo(log))
  if (allowCors) app.use(cors())
  if (requestBodyMaxLoggingLen) app.use(setMaxRequestLoggingLen(requestBodyMaxLoggingLen))
  if (responseBodyMaxLoggingLen) app.use(setMaxResponseLoggingLen(responseBodyMaxLoggingLen))

  middleware.forEach(mid => {
    app.use(mid)
  })

  routes.forEach(route => {
    app.use(route.routes())
  })

  app.use(handle404) // Use after routes so we can handle 404s

  if (beforeStartup) {
    beforeStartup(log)
      .then(() => {
        app.listen(port)
        log.info(`Server listening on port ${port}!`)
      })
      .catch(err => {
        log.error({ err }, 'The server failed to start')
      })
  } else {
    try {
      app.listen(port)
      log.info(`Server listening on port ${port}!`)
    } catch (err) {
      log.error({ err }, 'The server failed to start')
    }
  }

  return { app, log }
}

module.exports = {
  buildLogger,
  buildServer,
  buildRouter: options => new Router(typeof options === 'string' ? { prefix: options } : options),
  handleError,
}
