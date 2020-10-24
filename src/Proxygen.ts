import { createReadStream, existsSync, mkdirpSync, writeFileSync } from 'fs-extra'
import { createServer as createHttpServer, IncomingMessage, Server as HttpServer, ServerResponse } from 'http'
import ProxyServer, { createProxyServer } from 'http-proxy'
import { createServer as createHttpsServer, Server as HttpsServer, ServerOptions as HttpsServerOptions } from 'https'
import { createCert } from 'mkcert'
import fetch from 'node-fetch'
import { homedir } from 'os'
import { dirname, join } from 'path'
import { createSecureContext, SecureContextOptions } from 'tls'
import { Proxy, ProxyConfig } from './Proxy'
import { getHost } from './utils'

const CA = {
  key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAp/ozz6EdexmKEIKrm5N9Q5VM/gLiAHWj0sVlDOJnZq/Nz+KG\nWZ5lSKoh6B0GVzZY0VI93V9ucUnBEbZEcXloMf6061x5/TTAb4lTbh8xP6g1x48l\nLxV3rJWkjyZ8voIP7u+sp2o+HpZ6cHFC+fSBokZ1i+8HTJxkd+pL752gYie1b8go\nJ5AWWSCRddxT6pJa2mg2Yrour0wIImCVf43eqFbVRSAa5J22cC0VfYr2/eVYVE7n\nxMzPlPMNDe0F3BLcAdVSC3g+/z5HYTwd0Qr4xa5mR4usG/4ByxaAUSXpiBj3sAfm\n6THY2MFt/SdRcJjU7PImv6PGhwV2lNeqQxPFPQIDAQABAoIBABSOVdDO0qDB21dx\n5jY/slCW8LkU+Ts9KjMc3OTav/SdBv6tpetJqvNdfpC9HI2HpQ7YlaGFkCpk8C+O\nsomAZfPYS6ORyYvm7LW5hHAxeQFlQE+PgOlmIyMHnP+3ogRePjzrL6G9KqTrnUgt\nVBjqhwKoxLG/KpGBgfn6vhgwnfPk3TryD+aZZ/8jvrKBb5A5ra0KY6BeEj/+YH7o\n6vqsm6WGW0Xyw4ybXTzK19dUWeG1mTyXmQtgzne/hJ3PCY3t+tEvj9B2EDSe/SRa\nEEf9d7LNvMDnhOej6XiL4azUgX+g1sAKNcnjzRmMG2bOCM0caa2wAhyg+OIcxHb6\ncFonawECgYEA3kJ+FaKW/bSxpHLsdkncs3C5FA0mjZUV3foGFicUW0YNXIocCP5t\nI29x0TWEujSj7Ne5KqrHSxh8f4vPZSUhDipT4E076z2aJyskeS17jW0z/ZOop9mq\nljuhBeGH2ADyu62dJMnuL5P7qDbqmgQlK+rd3cDUo/S2ssj1NDy6ra0CgYEAwXos\n/3lP9sobfdt6t2Xv0NKCCqAWi9dqHXnle0XYsGMd6C+mr/zznJLsZ1L/r+NyWvIm\n/LgostENVQfvrts4g/D3QwLeNIRAmzBfQHi7OUk9AjfmaAEuvYROuFama8tBnCAC\nIR0LANCLZGN+fBRQNBz3TtksKoRWeJm9tdilR9ECgYEA0+OSLnAOAJsWTA/gDLlH\n9a3+U/ZhjdLWwQOOb+obxxRWwqVMKurcA09Is8mQ2rA6ox3aAqpDSv1yG2qfcu7d\nv5Js2kbnW9IjtzmzEO9ifabhTNtLi5HAxm7ciS3EgxIMVw4h5SO5tpQe8/Q+3kwb\nX+4OTE18qz4uOu3Ijl9jHRUCgYBnxO2JgDlBNhkUobjp0ISVTbJtnHs7OagycwR/\n33Be+mo59ATE8zh9y9d7e2qjnavh12rNtMAvWCx8ZKtK700ahw03JbykEiLMmV8d\nJyPTj9Jm9DBhq/CzuNi3ydGskvF3mTtLI1aZc0Cv8SUPy51QthB2e8hSbXQrbtnv\nRGkxYQKBgBKBVVP0QhQF1SAObGKfvVc430DuTkbDShKzVIB2QUl8bqLFo1XZHUUQ\neTB6HlI3GM2FHZshCYsdyNQ8vJYDLsIjtdyWmuMjpHsoLEen6Bpnz4lRs+uXb15z\nkR8gzYrxgtdiumubPiu8sJTiLtqhBv5Ce7w7QcQpgdOOoKcpNXiv\n-----END RSA PRIVATE KEY-----',
  cert: '-----BEGIN CERTIFICATE-----\nMIIDWDCCAkCgAwIBAgIFNjQ0ODAwDQYJKoZIhvcNAQELBQAwWzERMA8GA1UEAxMI\ncHJveHlnZW4xCzAJBgNVBAYTAlNHMRIwEAYDVQQIEwlTaW5nYXBvcmUxEjAQBgNV\nBAcTCVNpbmdhcG9yZTERMA8GA1UEChMIcHJveHlnZW4wHhcNMjAxMDI0MDQwMjU5\nWhcNNDAxMDE5MDQwMjU5WjBbMREwDwYDVQQDEwhwcm94eWdlbjELMAkGA1UEBhMC\nU0cxEjAQBgNVBAgTCVNpbmdhcG9yZTESMBAGA1UEBxMJU2luZ2Fwb3JlMREwDwYD\nVQQKEwhwcm94eWdlbjCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKf6\nM8+hHXsZihCCq5uTfUOVTP4C4gB1o9LFZQziZ2avzc/ihlmeZUiqIegdBlc2WNFS\nPd1fbnFJwRG2RHF5aDH+tOtcef00wG+JU24fMT+oNcePJS8Vd6yVpI8mfL6CD+7v\nrKdqPh6WenBxQvn0gaJGdYvvB0ycZHfqS++doGIntW/IKCeQFlkgkXXcU+qSWtpo\nNmK6Lq9MCCJglX+N3qhW1UUgGuSdtnAtFX2K9v3lWFRO58TMz5TzDQ3tBdwS3AHV\nUgt4Pv8+R2E8HdEK+MWuZkeLrBv+AcsWgFEl6YgY97AH5ukx2NjBbf0nUXCY1Ozy\nJr+jxocFdpTXqkMTxT0CAwEAAaMjMCEwDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8B\nAf8EBAMCAgQwDQYJKoZIhvcNAQELBQADggEBABYUFq8Dnx5ZQlawSXeChEHYYIxK\nf9xwTvkwhEU9xJ0cg/dxRaG9sXEXG6Qzbn4kzNdlesuUvGl6U0L5DkvFBGbMHJep\nGGt+STYElOT1WocXWG/zr13vtInmX4i8guWoYP0cZ5WEnndUxgLBh/XzM/rPf7tG\neQ4FrhsoFey1TvU60lXrKnatFsQeH74sNfKxzXcptxhsO5ShR44rwXayjOw4R5XG\nzrd6K8+I/Mf9hQrPG8QEBMaqpxgBUa0A5J1U+HIJBLlix8+w1sWhENg8A5qcjiAb\nO1TtDMAWwtCoENvnPzyauGe5QinLqE57x4idyFfuyJA1Ka7oal0mAYoH6ic=\n-----END CERTIFICATE-----'
}

export interface ProxygenConfig {
  domains: string[]
  proxies: ProxyConfig[]
}

export class Proxygen {
  private domains: string[]
  private proxies: Proxy[]
  private proxyServer!: ProxyServer
  private httpServer!: HttpServer
  private httpsServer!: HttpsServer

  constructor({ domains, proxies }: ProxygenConfig) {
    this.domains = domains
    this.proxies = proxies.map((config) => new Proxy(config)).sort((a, b) => a.priority - b.priority)
  }

  async start() {
    this.proxyServer = this.createProxyServer()
    this.httpServer = this.createHttpServer()
    this.httpsServer = this.createHttpsServer(await this.createCertificate())
    await new Promise<void>((resolve) => { this.httpServer.listen(80, '0.0.0.0', resolve) })
    await new Promise<void>((resolve) => { this.httpsServer!.listen(443, '0.0.0.0', resolve) })
  }

  private onRequest(req: IncomingMessage, res: ServerResponse) {
    const result = this.handleRequest(req)
    if (!result) { return this.notFound(res) }
    const { action, url } = result
    const fullPath = `${url.path}${url.query ? `?${url.query}` : ''}`
    const remoteUrl = `${url.protocol}//${url.host}${fullPath}`
    if (action.type === 'redirect') {
      res.writeHead(302, { Location: remoteUrl })
      res.end()
    } else if (action.type === 'cache') {
      const filepath = join(action.root, fullPath)
      if (req.method === 'GET' && !existsSync(filepath)) {
        fetch(remoteUrl, { method: 'GET', compress: true }).then((response) => response.buffer()).then((buffer) => {
          mkdirpSync(dirname(filepath))
          writeFileSync(filepath, buffer)
        }).catch(() => { res.statusCode = 500; res.end() })
        if (url.host) { req.headers['host'] = url.host }
        if (url.path) { req.url = fullPath }
        this.proxyServer.web(req, res, { target: url, secure: true })
      } else if (existsSync(filepath)) {
        const readStream = createReadStream(filepath)
        readStream.on('open', () => { readStream.pipe(res) })
        readStream.on('error', (err) => { res.end(err) })
      } else {
        debugger
      }
    } else if (action.type === 'proxy') {
      if (url.host) { req.headers['host'] = url.host }
      if (url.path) { req.url = fullPath }
      this.proxyServer.web(req, res, { target: url, secure: true })
    }
  }

  private async createCertificate() {
    const rootPath = join(homedir(), '.proxygen')
    const caCertPath = join(rootPath, 'proxygen.ca.cert.pem')
    process.env.NODE_EXTRA_CA_CERTS = caCertPath
    if (!existsSync(rootPath)) { mkdirpSync(rootPath) }
    if (!existsSync(caCertPath)) { writeFileSync(caCertPath, CA.cert, 'utf8') }
    const { key, cert } = await createCert({ domains: this.domains, validityDays: 365, caKey: CA.key, caCert: CA.cert })
    return { key, cert, ca: CA.cert }
  }

  private createProxyServer() {
    const proxyServer = createProxyServer({ xfwd: true, prependPath: false, secure: true })
    proxyServer.on('proxyReq', (proxyReq, req) => {
      const forceHost = getHost(req)
      if (forceHost) { proxyReq.setHeader('host', forceHost) }
      proxyReq.setHeader('host', req.headers['host']!)
    })
    return proxyServer
  }

  private createHttpServer() {
    const httpServer = createHttpServer(this.onRequest.bind(this))
    httpServer.on('upgrade', this.websocketsUpgrade.bind(this))
    httpServer.on('error', console.error)
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
    httpsServer.on('error', console.error)
    httpsServer.on('clientError', console.error)
    return httpsServer
  }

  private handleRequest(req: IncomingMessage) {
    const proxy = this.proxies.find((p) => p.shouldHandleRequest(req))
    if (!proxy) { return null }
    return proxy.handleRequest(req)
  }

  private websocketsUpgrade(req: IncomingMessage, res: ServerResponse, head: unknown) {
    res.on('error', console.error)
    const result = this.handleRequest(req)
    if (!result) { return this.notFound(res) }
    if (result.url.host) { req.headers.host = result.url.host }
    this.proxyServer.ws(req, res, head, { target: result.url })
  }

  private notFound(res: ServerResponse) {
    res.statusCode = 404
    res.write('Not Found')
    res.end()
    return
  }
}
