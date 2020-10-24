import { IncomingMessage } from 'http'
import { Socket } from 'net'
import { parse } from 'uri-js'
import { Url } from 'url'
import { formatString, getHost } from './utils'

export type ProxyConditionTarget = 'host' | 'path' | 'url' | 'protocol' | 'extension' | 'query'
export type ProxyConditionType = 'matches' | 'equals' | 'contains'
export type ProxyConditionOutcome = 'continue' | 'pass' | 'fail'

export interface ProxyCondition {
  target: ProxyConditionTarget
  type: ProxyConditionType
  value: string | number
  then?: ProxyConditionOutcome
  else?: ProxyConditionOutcome
}

export type ProxyAction = {
  type: string
  host?: string
  protocol?: 'http' | 'https'
  port?: number
  path?: string
  query?: string
} & (
    { type: 'proxy' } |
    { type: 'redirect' } |
    { type: 'cache', root: string }
  )

export interface ProxyResult {
  url: Partial<Url>
  action: ProxyAction
}

export interface ProxyScope {
  protocol: string
  host: string
  path: string
  url: string
  query?: string
  extension?: string
}

export interface ProxyConfig {
  priority?: number
  conditions?: ProxyCondition[]
  action: ProxyAction
}

export class Proxy {
  public priority: number
  private conditions: ProxyCondition[]
  private action: ProxyAction

  constructor({ priority, conditions, action }: ProxyConfig) {
    this.priority = priority ?? 1
    this.conditions = conditions ?? []
    this.action = action
  }

  shouldHandleRequest(req: IncomingMessage) {
    const scope = this.getScope(req)
    if (this.conditions.length === 0) { return true }
    for (const condition of this.conditions) {
      const checkPassed = this.conditionCheck(condition.type, condition.value, scope[condition.target] ?? '')
      if (checkPassed && condition.then === 'pass') { return true }
      if (checkPassed && condition.then === 'fail') { return false }
      if (!checkPassed && condition.else === 'pass') { return true }
      if (!checkPassed && condition.else === 'fail') { return false }
    }
    return false
  }

  handleRequest(req: IncomingMessage): ProxyResult {
    const scope = this.getScope(req)
    const regex = /:(protocol|host|path|url|query|extension)/g
    const protocol = this.action.protocol ? formatString<ProxyScope>(this.action.protocol, regex, scope) : scope.protocol
    const host = this.action.host ? formatString<ProxyScope>(this.action.host, regex, scope) : scope.host
    const path = this.action.path ? formatString<ProxyScope>(this.action.path, regex, scope) : scope.path
    const query = this.action.query ? formatString<ProxyScope>(this.action.query, regex, scope) : scope.query
    const url: Partial<Url> = { protocol, host, path, query }
    if (this.action.port) { url.port = String(this.action.port) }
    return { url, action: this.action }
  }

  private getScope(req: IncomingMessage): ProxyScope {
    const host = getHost(req)!
    const { encrypted } = req.socket as Socket & { encrypted: boolean }
    const info = parse(req.url ?? '/')!
    const path = info.path ?? '/'
    const query = info.query
    const protocol = encrypted ? 'https:' : 'http:'
    const extension = path.split('.').pop()
    const url = `${protocol}//${host}${path}${query ? `?${query}` : ''}`
    return { protocol, host, path, query, url, extension }
  }

  private conditionCheck(type: ProxyConditionType, conditionValue: string | number, value: string) {
    if (type === 'equals' && value === conditionValue) { return true }
    if (type === 'matches' && new RegExp(String(conditionValue)).test(value)) { return true }
    if (type === 'contains' && value.includes(String(conditionValue))) { return true }
    return false
  }
}
