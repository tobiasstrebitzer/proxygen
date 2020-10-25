import { createReadStream } from 'fs-extra'
import { createServer as createHttpServer, IncomingMessage, Server as HttpServer, ServerResponse } from 'http'
import ProxyServer, { createProxyServer } from 'http-proxy'
import { createServer as createHttpsServer, Server as HttpsServer, ServerOptions as HttpsServerOptions } from 'https'
import { join } from 'path'
import pino, { Logger } from 'pino'
import { createSecureContext, SecureContextOptions } from 'tls'
import { Proxy, ProxyConfig, ProxyResponse } from './Proxy'
import { ProxygenSocket, ProxyReq, ProxyRequest } from './ProxyRequest'
import { createCertificate, getHost, statFile } from './utils'

export interface LogPayload {
  msg: string
  type: string
  level?: string
  statusCode?: number
  method?: string
}

export interface ProxygenConfig {
  hosts: string[]
  proxies: ProxyConfig[]
}

export class Proxygen {
  private hosts: string[]
  private proxies: Proxy[]
  private proxyServer!: ProxyServer
  private httpServer!: HttpServer
  private httpsServer!: HttpsServer
  private logger: Logger
  private loggers = new Map<string, Logger>()

  constructor({ hosts, proxies }: ProxygenConfig) {
    this.hosts = hosts
    this.proxies = proxies.map((config) => new Proxy(config))
    this.logger = this.createLogger()
    for (const host of hosts) {
      this.loggers.set(host, this.logger.child({ name: host }))
    }
  }

  async start() {
    this.proxyServer = this.createProxyServer()
    this.httpServer = this.createHttpServer()
    this.logger.info({ msg: `creating certificate for ${this.hosts.join(', ')}` })
    this.httpsServer = this.createHttpsServer(await createCertificate(this.hosts))
    await new Promise<void>((resolve) => { this.httpServer.listen(80, '0.0.0.0', resolve) })
    await new Promise<void>((resolve) => { this.httpsServer!.listen(443, '0.0.0.0', resolve) })
    this.logger.info({ msg: 'proxygen running on http://127.0.0.1/proxygen/status' })
  }

  private onRequest(req: IncomingMessage, res: ServerResponse) {
    const request = new ProxyRequest(req, res)
    const response = this.handleRequest(request)
    this.logRequest(request, response)
    if (response.action.type === 'options') {
      this.handleOptions(request, response)
    } else if (response.action.type === 'notFound') {
      this.handleNotFound(request, response)
    } else if (response.action.type === 'status') {
      this.handleStatus(request, response)
    } else if (response.action.type === 'redirect') {
      this.handleRedirect(request, response)
    } else if (response.action.type === 'cache') {
      this.handleCache(request, response)
    } else if (response.action.type === 'proxy') {
      this.handleProxy(request, response)
    }
  }

  private createProxyServer() {
    const proxyServer = createProxyServer({ xfwd: true, prependPath: false, secure: true })
    proxyServer.on('proxyReq', (proxyReq, req) => {
      const forceHost = getHost(req)
      if (forceHost) { proxyReq.setHeader('host', forceHost) }
      proxyReq.setHeader('host', req.headers['host']!)
    })
    proxyServer.on('proxyRes', (proxyRes, req: ProxyReq, res) => {
      if (req.__request) {
        req.__request.enableCors()
        req.__request.resolve(res)
      }
    })
    proxyServer.on('error', (error, req: ProxyReq, res, url) => {
      if (req.__request) { req.__request.reject(error) }
    })
    return proxyServer
  }

  private createHttpServer() {
    const httpServer = createHttpServer(this.onRequest.bind(this))
    httpServer.on('upgrade', this.websocketsUpgrade.bind(this))
    httpServer.on('error', (error) => { this.logError(error) })
    return httpServer
  }

  private createHttpsServer(options: SecureContextOptions) {
    const credentials = createSecureContext(options)
    const sslOptions: HttpsServerOptions = {
      SNICallback: (_, cb) => {
        if (cb) { cb(null, credentials); return }
        return credentials
      },
      ...options
    }
    const httpsServer = createHttpsServer(sslOptions, this.onRequest.bind(this))
    httpsServer.on('upgrade', this.websocketsUpgrade.bind(this))
    httpsServer.on('error', (error) => { this.logError(error) })
    httpsServer.on('clientError', this.onClientError.bind(this))
    httpsServer.on('tslClientError', this.onClientError.bind(this))
    return httpsServer
  }

  private onClientError(error: Error & { code: string }, socket: ProxygenSocket) {
    socket.destroy()
    if (error.code === 'ECONNRESET') { return }
    this.logError(error, socket.__host)

  }

  private handleRequest(request: ProxyRequest): ProxyResponse {
    if (request.method === 'GET' && request.path === '/proxygen/status') { return { host: request.host, action: { type: 'status' } } }
    if (request.method === 'OPTIONS') { return { host: request.host, action: { type: 'options' } } }
    const proxy = this.proxies.find((p) => p.shouldHandleRequest(request))
    if (!proxy) { return { host: request.host, action: { type: 'notFound' } } }
    return proxy.handleRequest(request)
  }

  private websocketsUpgrade(req: IncomingMessage, res: ServerResponse, head: unknown) {
    const request = new ProxyRequest(req, res)
    res.on('error', (error) => { this.logError(error) })
    const result = this.handleRequest(request)
    if (result.host) { req.headers.host = result.host }
    this.proxyServer.ws(req, res, head, { target: result.url })
  }

  private handleRedirect(request: ProxyRequest, response: ProxyResponse) {
    request.redirect(response.url!)
  }

  private handleOptions(request: ProxyRequest, response: ProxyResponse) {
    request.enableCors()
    request.respond()
  }

  private handleProxy(request: ProxyRequest, response: ProxyResponse) {
    request.proxy(this.proxyServer, response).then((proxyResponse) => {
      this.logResponse(request, response, proxyResponse.statusCode)
    }).catch((error: Error) => {
      this.logResponse(request, response, 'ERROR', 'error')
      this.logError(error, request.host)
    })
  }

  private handleCache(request: ProxyRequest, response: ProxyResponse) {
    if (!response.action.root) { throw new Error('Missing root configuration for cache proxy') }
    const filepath = join(response.action.root, String(response.pathWithQuery))
    const stats = statFile(filepath)
    if (stats.isFile) {
      this.logResponse(request, response, 'HIT')
      request.enableCors()
      return request.stream(createReadStream(filepath))
    }
    if (response.url && request.method === 'GET' && !stats.exists) {
      request.cache(filepath, response).catch((error) => { this.logError(error, request.host) })
    }
    this.handleProxy(request, response)
  }

  private handleNotFound(request: ProxyRequest, response: ProxyResponse) {
    request.respond('Not found', 404)
  }

  private handleStatus(request: ProxyRequest, response: ProxyResponse) {
    request.respond('ok', 200)
  }

  private createLogger() {
    return pino({
      name: 'proxygen',
      level: 'info',
      prettyPrint: { colorize: true, ignore: 'hostname,pid,message,method,statusCode,host,name,type' },
      prettifier: require('pino-pretty')
    })
  }

  private logRequest(request: ProxyRequest, response: ProxyResponse) {
    const payload: LogPayload = { msg: `~> ${request.url}`, method: request.method, type: response.action.type }
    if (payload.type === 'notFound') { payload.statusCode = 404 }
    if (payload.type === 'status') { payload.statusCode = 200 }
    if (payload.type) { payload.msg = `(${payload.type}) ${payload.msg}` }
    if (payload.method) { payload.msg = `[${payload.method}] ${payload.msg}` }
    if (payload.statusCode) { payload.msg = `${payload.msg} {${payload.statusCode}}` }
    const logger = this.loggers.get(request.host) ?? this.logger
    logger.info(payload)
  }

  private logResponse(request: ProxyRequest, response: ProxyResponse, proxyResponse: string | number, level = 'info') {
    const payload: LogPayload = { msg: `<~ ${response.url}`, method: request.method, type: response.action.type, level }
    if (payload.type) { payload.msg = `(${payload.type}) ${payload.msg}` }
    if (payload.method) { payload.msg = `[${payload.method}] ${payload.msg}` }
    payload.msg = `${payload.msg} {${proxyResponse}}`
    const logger = this.loggers.get(request.host) ?? this.logger
    logger.info(payload)
  }

  private logError(error: Error, host = '127.0.0.1') {
    const logger = this.loggers.get(host) ?? this.logger
    logger.error({ ...error, msg: error.message, host })
  }
}
