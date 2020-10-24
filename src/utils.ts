import { IncomingMessage } from 'http'

export function getHost(req: IncomingMessage, fallback?: string) {
  const forwardedHeader = req.headers['x-forwarded-host'] as string
  if (forwardedHeader) { return forwardedHeader.split(':')[0] }
  if (req.headers.host) { return req.headers.host.split(':')[0] }
  return fallback
}

export function formatString<T extends object>(value: string, regex: RegExp, scope: T) {
  return value.replace(regex, (_, token: keyof T) => {
    return String(scope[token])
  })
}
