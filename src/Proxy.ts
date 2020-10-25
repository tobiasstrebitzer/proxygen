import { ProxyRequest } from './ProxyRequest'
import { formatString } from './utils'

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
  type: 'status' | 'notFound' | 'proxy' | 'redirect' | 'cache'
  host?: string
  protocol?: 'http' | 'https'
  port?: number
  path?: string
  query?: string
  root?: string
  excludeHost?: boolean
}

export interface ProxyResponse {
  action: ProxyAction
  host: string
  url?: string
  path?: string
  query?: string
  pathWithQuery?: string
}

export interface ProxyConfig {
  conditions?: ProxyCondition[]
  action: ProxyAction
}

export class Proxy {
  private conditions: ProxyCondition[]
  private action: ProxyAction

  constructor({ conditions, action }: ProxyConfig) {
    this.conditions = conditions ?? []
    this.action = action
  }

  shouldHandleRequest(request: ProxyRequest) {
    if (this.conditions.length === 0) { return true }
    for (const condition of this.conditions) {
      const checkPassed = this.conditionCheck(condition.type, condition.value, request[condition.target] ?? '')
      if (checkPassed && condition.then === 'pass') { return true }
      if (checkPassed && condition.then === 'fail') { return false }
      if (!checkPassed && condition.else === 'pass') { return true }
      if (!checkPassed && condition.else === 'fail') { return false }
    }
    return false
  }

  handleRequest(request: ProxyRequest): ProxyResponse {
    const regex = /:(protocol|host|path|url|query|extension)/g
    const protocol = this.action.protocol ? formatString<ProxyRequest>(this.action.protocol, regex, request) : request.protocol
    const host = this.action.host ? formatString<ProxyRequest>(this.action.host, regex, request) : request.host
    const path = this.action.path ? formatString<ProxyRequest>(this.action.path, regex, request) : request.path
    const query = this.action.query ? formatString<ProxyRequest>(this.action.query, regex, request) : request.query
    const pathWithQuery = `${path}${query ? `?${query}` : ''}`
    const port = this.action.port ? String(this.action.port) : null
    const url = `${protocol}//${host}${port ? `:${port}` : ''}${pathWithQuery}`
    return { url, host, path, query, pathWithQuery, action: this.action }
  }

  private conditionCheck(type: ProxyConditionType, conditionValue: string | number, value: string) {
    if (type === 'equals' && value === conditionValue) { return true }
    if (type === 'matches' && new RegExp(String(conditionValue)).test(value)) { return true }
    if (type === 'contains' && value.includes(String(conditionValue))) { return true }
    return false
  }
}
