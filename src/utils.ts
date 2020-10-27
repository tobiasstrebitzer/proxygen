import { existsSync, lstatSync, mkdirpSync, writeFileSync } from 'fs-extra'
import { IncomingMessage } from 'http'
import { lookup } from 'mime-types'
import { createCert } from 'mkcert'
import { Magic, MAGIC_MIME_TYPE } from 'mmmagic'
import { homedir } from 'os'
import { join } from 'path'

export const CA = {
  key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAp/ozz6EdexmKEIKrm5N9Q5VM/gLiAHWj0sVlDOJnZq/Nz+KG\nWZ5lSKoh6B0GVzZY0VI93V9ucUnBEbZEcXloMf6061x5/TTAb4lTbh8xP6g1x48l\nLxV3rJWkjyZ8voIP7u+sp2o+HpZ6cHFC+fSBokZ1i+8HTJxkd+pL752gYie1b8go\nJ5AWWSCRddxT6pJa2mg2Yrour0wIImCVf43eqFbVRSAa5J22cC0VfYr2/eVYVE7n\nxMzPlPMNDe0F3BLcAdVSC3g+/z5HYTwd0Qr4xa5mR4usG/4ByxaAUSXpiBj3sAfm\n6THY2MFt/SdRcJjU7PImv6PGhwV2lNeqQxPFPQIDAQABAoIBABSOVdDO0qDB21dx\n5jY/slCW8LkU+Ts9KjMc3OTav/SdBv6tpetJqvNdfpC9HI2HpQ7YlaGFkCpk8C+O\nsomAZfPYS6ORyYvm7LW5hHAxeQFlQE+PgOlmIyMHnP+3ogRePjzrL6G9KqTrnUgt\nVBjqhwKoxLG/KpGBgfn6vhgwnfPk3TryD+aZZ/8jvrKBb5A5ra0KY6BeEj/+YH7o\n6vqsm6WGW0Xyw4ybXTzK19dUWeG1mTyXmQtgzne/hJ3PCY3t+tEvj9B2EDSe/SRa\nEEf9d7LNvMDnhOej6XiL4azUgX+g1sAKNcnjzRmMG2bOCM0caa2wAhyg+OIcxHb6\ncFonawECgYEA3kJ+FaKW/bSxpHLsdkncs3C5FA0mjZUV3foGFicUW0YNXIocCP5t\nI29x0TWEujSj7Ne5KqrHSxh8f4vPZSUhDipT4E076z2aJyskeS17jW0z/ZOop9mq\nljuhBeGH2ADyu62dJMnuL5P7qDbqmgQlK+rd3cDUo/S2ssj1NDy6ra0CgYEAwXos\n/3lP9sobfdt6t2Xv0NKCCqAWi9dqHXnle0XYsGMd6C+mr/zznJLsZ1L/r+NyWvIm\n/LgostENVQfvrts4g/D3QwLeNIRAmzBfQHi7OUk9AjfmaAEuvYROuFama8tBnCAC\nIR0LANCLZGN+fBRQNBz3TtksKoRWeJm9tdilR9ECgYEA0+OSLnAOAJsWTA/gDLlH\n9a3+U/ZhjdLWwQOOb+obxxRWwqVMKurcA09Is8mQ2rA6ox3aAqpDSv1yG2qfcu7d\nv5Js2kbnW9IjtzmzEO9ifabhTNtLi5HAxm7ciS3EgxIMVw4h5SO5tpQe8/Q+3kwb\nX+4OTE18qz4uOu3Ijl9jHRUCgYBnxO2JgDlBNhkUobjp0ISVTbJtnHs7OagycwR/\n33Be+mo59ATE8zh9y9d7e2qjnavh12rNtMAvWCx8ZKtK700ahw03JbykEiLMmV8d\nJyPTj9Jm9DBhq/CzuNi3ydGskvF3mTtLI1aZc0Cv8SUPy51QthB2e8hSbXQrbtnv\nRGkxYQKBgBKBVVP0QhQF1SAObGKfvVc430DuTkbDShKzVIB2QUl8bqLFo1XZHUUQ\neTB6HlI3GM2FHZshCYsdyNQ8vJYDLsIjtdyWmuMjpHsoLEen6Bpnz4lRs+uXb15z\nkR8gzYrxgtdiumubPiu8sJTiLtqhBv5Ce7w7QcQpgdOOoKcpNXiv\n-----END RSA PRIVATE KEY-----',
  cert: '-----BEGIN CERTIFICATE-----\nMIIDWDCCAkCgAwIBAgIFNjQ0ODAwDQYJKoZIhvcNAQELBQAwWzERMA8GA1UEAxMI\ncHJveHlnZW4xCzAJBgNVBAYTAlNHMRIwEAYDVQQIEwlTaW5nYXBvcmUxEjAQBgNV\nBAcTCVNpbmdhcG9yZTERMA8GA1UEChMIcHJveHlnZW4wHhcNMjAxMDI0MDQwMjU5\nWhcNNDAxMDE5MDQwMjU5WjBbMREwDwYDVQQDEwhwcm94eWdlbjELMAkGA1UEBhMC\nU0cxEjAQBgNVBAgTCVNpbmdhcG9yZTESMBAGA1UEBxMJU2luZ2Fwb3JlMREwDwYD\nVQQKEwhwcm94eWdlbjCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKf6\nM8+hHXsZihCCq5uTfUOVTP4C4gB1o9LFZQziZ2avzc/ihlmeZUiqIegdBlc2WNFS\nPd1fbnFJwRG2RHF5aDH+tOtcef00wG+JU24fMT+oNcePJS8Vd6yVpI8mfL6CD+7v\nrKdqPh6WenBxQvn0gaJGdYvvB0ycZHfqS++doGIntW/IKCeQFlkgkXXcU+qSWtpo\nNmK6Lq9MCCJglX+N3qhW1UUgGuSdtnAtFX2K9v3lWFRO58TMz5TzDQ3tBdwS3AHV\nUgt4Pv8+R2E8HdEK+MWuZkeLrBv+AcsWgFEl6YgY97AH5ukx2NjBbf0nUXCY1Ozy\nJr+jxocFdpTXqkMTxT0CAwEAAaMjMCEwDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8B\nAf8EBAMCAgQwDQYJKoZIhvcNAQELBQADggEBABYUFq8Dnx5ZQlawSXeChEHYYIxK\nf9xwTvkwhEU9xJ0cg/dxRaG9sXEXG6Qzbn4kzNdlesuUvGl6U0L5DkvFBGbMHJep\nGGt+STYElOT1WocXWG/zr13vtInmX4i8guWoYP0cZ5WEnndUxgLBh/XzM/rPf7tG\neQ4FrhsoFey1TvU60lXrKnatFsQeH74sNfKxzXcptxhsO5ShR44rwXayjOw4R5XG\nzrd6K8+I/Mf9hQrPG8QEBMaqpxgBUa0A5J1U+HIJBLlix8+w1sWhENg8A5qcjiAb\nO1TtDMAWwtCoENvnPzyauGe5QinLqE57x4idyFfuyJA1Ka7oal0mAYoH6ic=\n-----END CERTIFICATE-----'
}

export function getHost(req: IncomingMessage) {
  const forwardedHeader = req.headers['x-forwarded-host'] as string
  if (forwardedHeader) { return forwardedHeader.split(':')[0] }
  if (req.headers.host) { return req.headers.host.split(':')[0] }
  return '127.0.0.1'
}

export function formatString<T extends object>(value: string, regex: RegExp, scope: T) {
  return value.replace(regex, (_, token: keyof T) => {
    return String(scope[token])
  })
}

export interface StatFileResult {
  exists: boolean
  isFile: boolean
  isDirectory: boolean
}

export function statFile(filepath: string): StatFileResult {
  if (!existsSync(filepath)) { return { exists: false, isFile: false, isDirectory: false } }
  const stats = lstatSync(filepath)
  return { exists: false, isFile: stats.isFile(), isDirectory: stats.isDirectory() }
}

export async function createCertificate(domains: string[]) {
  const rootPath = join(homedir(), '.proxygen')
  const caCertPath = join(rootPath, 'proxygen.ca.cert.pem')
  process.env.NODE_EXTRA_CA_CERTS = caCertPath
  if (!existsSync(rootPath)) { mkdirpSync(rootPath) }
  if (!existsSync(caCertPath)) { writeFileSync(caCertPath, CA.cert, 'utf8') }
  const { key, cert } = await createCert({ domains, validityDays: 365, caKey: CA.key, caCert: CA.cert })
  return { key, cert, ca: CA.cert }
}

const magic = new Magic(MAGIC_MIME_TYPE)

export function detectContentType(filepath: string) {
  return new Promise<string | null>((resolve) => {
    const contentType = lookup(filepath)
    if (contentType) { resolve(contentType); return }
    magic.detectFile(filepath, (error, result) => {
      if (error) {
        resolve(null)
      } else if (typeof result === 'string') {
        resolve(result)
      } else {
        resolve(result[0])
      }
    })
  })
}
