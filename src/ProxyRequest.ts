import { mkdirpSync, ReadStream, writeFileSync } from 'fs-extra'
import { IncomingMessage, ServerResponse } from 'http'
import ProxyServer from 'http-proxy'
import { Socket } from 'net'
import fetch from 'node-fetch'
import { dirname } from 'path'
import { TLSSocket } from 'tls'
import { ProxyResponse } from './Proxy'
import { getHost } from './utils'

export type ProxygenSocket = (Socket | TLSSocket) & { __host?: string, encrypted?: boolean }

export type ProxyReq = IncomingMessage & { __request?: ProxyRequest }

export interface ProxyScope {
  protocol: string
  host: string
  path: string
  url: string
  query?: string
  extension?: string
}

export class ProxyRequest {
  public host: string
  private socket: ProxygenSocket
  private promise: Promise<ServerResponse>
  resolve!: (value?: ServerResponse | PromiseLike<ServerResponse> | undefined) => void
  reject!: (error?: Error) => void

  constructor(private req: ProxyReq, private res: ServerResponse) {
    this.host = getHost(req)
    this.socket = req.socket
    this.socket.__host = this.host
    req.__request = this
    this.promise = new Promise<ServerResponse>((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
  }

  enableCors() {
    if (this.req.headers['access-control-request-method']) {
      this.res.setHeader('access-control-allow-methods', this.req.headers['access-control-request-method'])
    }
    if (this.req.headers['access-control-request-headers']) {
      this.res.setHeader('access-control-allow-headers', this.req.headers['access-control-request-headers'])
    }
    if (this.req.headers.origin) {
      this.res.setHeader('access-control-allow-origin', this.req.headers.origin)
      this.res.setHeader('access-control-allow-credentials', 'true')
    }
  }

  redirect(Location: string, statusCode = 302) {
    this.res.writeHead(statusCode, { Location })
    this.res.end()
  }

  proxy(proxyServer: ProxyServer, response: ProxyResponse) {
    if (!response.action.excludeHost) { this.req.headers['host'] = this.host }
    if (response.pathWithQuery) { this.req.url = response.pathWithQuery }
    proxyServer.web(this.req, this.res, { target: response.url, secure: true, changeOrigin: true })
    return this.promise
  }

  stream(stream: ReadStream) {
    stream.on('open', () => { stream.pipe(this.res) })
    stream.on('error', (error) => { this.res.end(error) })
  }

  respond(message?: string, statusCode = 200) {
    this.res.statusCode = statusCode
    this.res.end(message)
  }

  async cache(filepath: string, response: ProxyResponse) {
    const result = await fetch(response.url!, { method: 'GET', compress: true })
    if (!result.ok) { return }
    const buffer = await result.buffer()
    mkdirpSync(dirname(filepath))
    writeFileSync(filepath, buffer)
  }

  get encrypted() { return !!this.socket.encrypted }
  get protocol() { return this.encrypted ? 'https:' : 'http:' }
  get method() { return this.req.method }
  get pathWithQuery() { return this.req.url ?? '/' }
  get url() { return `${this.protocol}//${this.host}${this.pathWithQuery}` }
  get path() { return this.pathWithQuery.split('?')[0] }
  get query() { return this.pathWithQuery.split('?')[1] }
  get extension() { return this.path.split('.').pop() }
}
