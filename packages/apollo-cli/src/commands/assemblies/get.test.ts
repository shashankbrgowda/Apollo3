import fs from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from '@oclif/test'

import {
  CONFIG_FILE,
  TEST_DATA_DIR,
  VERBOSE,
  copyFile,
} from '../../test/fixtures.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

describe('apollo assemblies get: Fail without token', () => {
  before(() => {
    copyFile(`${TEST_DATA_DIR}/guest.yaml`, CONFIG_FILE, VERBOSE)
  })
  after(() => {
    fs.rmSync(CONFIG_FILE)
  })

  const cmd = ['assemblies:get']
  test
    .stderr()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .exit(1)
    .do((output) =>
      expect(output.stderr).to.contain('Profile "default" has no access token'),
    )
    .do((output) => expect(output.stderr).to.not.contain(' at async ')) // Don't print error stack
    .it(cmd.join(' '))
})

describe('apollo assemblies get: Get assemblies as YAML string', () => {
  before(() => {
    copyFile(`${TEST_DATA_DIR}/complete_config.yaml`, CONFIG_FILE, VERBOSE)
  })
  after(() => {
    fs.rmSync(CONFIG_FILE)
  })

  const cmd = ['assemblies:get']
  test
    .stdout()
    .command(cmd, { root: dirname(dirname(__dirname)) })
    .it(cmd.join(' '), (output) => {
      JSON.parse(output.stdout)
    })
})
