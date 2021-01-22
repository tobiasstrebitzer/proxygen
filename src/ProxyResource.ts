import { createReadStream } from 'fs-extra'
import { ProxyRequest } from './ProxyRequest'
import { statFile, StatFileResult } from './utils'

export class ProxyResource {
  private stats: StatFileResult

  constructor(private request: ProxyRequest, public path: string) {
    this.stats = statFile(this.path)
  }

  send(): void {
    this.request.enableCors()
    this.request.setContentType(this.path).then(() => { this.request.stream(createReadStream(this.path)) }).catch(() => { })
  }

  get exists(): boolean { return this.stats.exists }
  get isFile(): boolean { return this.stats.isFile }
}
