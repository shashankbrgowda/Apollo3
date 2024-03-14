import * as fs from 'node:fs'

import { Flags } from '@oclif/core'
import { ObjectId } from 'bson'

import { BaseCommand } from '../../baseCommand.js'
import {
  deleteAssembly,
  localhostToAddress,
  queryApollo,
  uploadFile,
} from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static description =
    'Add assembly sequences from local fasta file or external source'

  static flags = {
    'input-file': Flags.string({
      char: 'i',
      description: 'Input fasta file',
      required: true,
    }),
    assembly: Flags.string({
      char: 'a',
      description: 'Name for this assembly',
      required: true,
    }),
    index: Flags.string({
      char: 'x',
      description: 'URL of the index. Ignored if input is a local file',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Delete existing assembly, if it exists',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Get)

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    const assemblies = await queryApollo(
      access.address,
      access.accessToken,
      'assemblies',
    )
    for (const x of await assemblies.json()) {
      if (x['name' as keyof typeof x] === flags.assembly) {
        if (flags.force) {
          await deleteAssembly(
            access.address,
            access.accessToken,
            x['_id' as keyof typeof x],
          )
        } else {
          this.logToStderr(`Error: Assembly "${flags.assembly}" already exists`)
          this.exit(1)
        }
      }
    }

    const isExternal = isValidHttpUrl(flags['input-file'])
    let response: Response
    if (isExternal) {
      if (flags.index === undefined) {
        this.logToStderr(
          'Please provide the URL to the index of the external fasta file',
        )
        this.exit(1)
      }
      response = await addAssemblyFromExternal(
        access.address,
        access.accessToken,
        flags.assembly,
        flags['input-file'],
        flags.index,
      )
    } else {
      if (!isExternal && !fs.existsSync(flags['input-file'])) {
        this.logToStderr(`File ${flags['input-file']} does not exist`)
        this.exit(1)
      }

      const uploadId = await uploadFile(
        access.address,
        access.accessToken,
        flags['input-file'],
        'text/x-fasta',
      )

      response = await submitAssembly(
        access.address,
        access.accessToken,
        flags.assembly,
        uploadId,
      )
    }
    if (!response.ok) {
      const json = JSON.parse(await response.text())
      const message: string = json['message' as keyof typeof json]
      this.logToStderr(message)
      this.exit(1)
    }
  }
}

function isValidHttpUrl(x: string) {
  let url
  try {
    url = new URL(x)
  } catch {
    return false
  }
  return url.protocol === 'http:' || url.protocol === 'https:'
}

async function addAssemblyFromExternal(
  address: string,
  accessToken: string,
  assemblyName: string,
  fa: string,
  fai: string,
) {
  const body = {
    typeName: 'AddAssemblyFromExternalChange',
    assembly: new ObjectId().toHexString(),
    assemblyName,
    externalLocation: {
      fa,
      fai,
    },
  }

  const auth = {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  }

  const url = new URL(localhostToAddress(`${address}/changes`))
  const response = await fetch(url, auth)
  return response
}

async function submitAssembly(
  address: string,
  accessToken: string,
  assemblyName: string,
  fileId: string,
): Promise<Response> {
  const body = {
    typeName: 'AddAssemblyFromFileChange',
    assembly: new ObjectId().toHexString(),
    assemblyName,
    fileId,
  }

  const auth = {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  }

  const url = new URL(localhostToAddress(`${address}/changes`))
  const response = await fetch(url, auth)
  return response
}
