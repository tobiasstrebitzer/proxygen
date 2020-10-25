#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs-extra'
import { homedir } from 'os'
import { resolve } from 'path'
import { Proxygen, ProxygenConfig } from './index'

async function main() {
  const [arg] = process.argv.slice(-1)
  const configPath = resolve((/\.json$/.test(arg) ? arg : 'proxygen.json').replace('~', homedir()))
  if (!existsSync(configPath)) { throw new Error('Unable to detect path to proxygen config') }
  const config: ProxygenConfig = JSON.parse(readFileSync(configPath, 'utf8'))
  const proxygen = new Proxygen(config)
  await proxygen.start()
}

main().catch((error: Error) => { console.error(error.message) })
