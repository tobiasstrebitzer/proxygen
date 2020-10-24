#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs-extra'
import { homedir } from 'os'
import { resolve } from 'path'
import { Proxygen, ProxygenConfig } from './index'

async function main() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  const [arg] = process.argv.slice(-1)
  const configPath = resolve((/\.json$/.test(arg) ? arg : 'proxygen.json').replace('~', homedir()))
  if (!existsSync(configPath)) { throw new Error('Unable to detect path to proxygen config') }
  const config: ProxygenConfig = JSON.parse(readFileSync(configPath, 'utf8'))
  const proxygen = new Proxygen(config)
  await proxygen.start()
  console.info('proxygen is running')
}

main().catch((error: Error) => { console.error(error.message) })
