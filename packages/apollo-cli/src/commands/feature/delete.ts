import * as fs from 'node:fs'

import { Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'
import { getFeatureById, localhostToAddress } from '../../utils.js'

async function deleteFeature(
  address: string,
  accessToken: string,
  feature: object,
): Promise<Response> {
  const changeJson = {
    typeName: 'DeleteFeatureChange',
    changedIds: [feature],
    assembly: feature['assembly' as keyof typeof feature],
    deletedFeature: {
      _id: feature['_id' as keyof typeof feature],
      gffId: feature['gffId' as keyof typeof feature],
      refSeq: feature['refSeq' as keyof typeof feature],
      type: feature['type' as keyof typeof feature],
      start: feature['start' as keyof typeof feature],
      end: feature['end' as keyof typeof feature],
      discontinuousLocations:
        feature['discontinuousLocations' as keyof typeof feature],
      score: feature['score' as keyof typeof feature],
      attributes: feature['attributes' as keyof typeof feature],
    },
  }
  const url = new URL(localhostToAddress(`${address}/changes`))
  const auth = {
    method: 'POST',
    body: JSON.stringify(changeJson),
    headers: {
      authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  }
  return fetch(url, auth)
}

export default class Delete extends BaseCommand<typeof Delete> {
  static description = 'Delete a feature'

  static flags = {
    'feature-id': Flags.string({
      char: 'i',
      default: '-',
      description: 'Feature ID to delete',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Delete)

    let featureId = flags['feature-id']
    if (featureId === '-') {
      featureId = fs.readFileSync(process.stdin.fd).toString().trim()
    }

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    const response: Response = await getFeatureById(
      access.address,
      access.accessToken,
      featureId,
    )
    const feature = JSON.parse(await response.text())
    if (!response.ok) {
      const message: string = feature['message' as keyof typeof feature]
      this.logToStderr(message)
      this.exit(1)
    }
    const delFet: Response = await deleteFeature(
      access.address,
      access.accessToken,
      feature,
    )
    if (!delFet.ok) {
      const json = await delFet.json()
      const message: string = json['message' as keyof typeof json]
      this.logToStderr(message)
      this.exit(1)
    }
  }
}