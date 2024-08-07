import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const TEST_DATA_DIR = path.resolve('test_data')
export const VERBOSE = false
export const CONFIG_DIR = path.join(os.homedir(), '.config', 'apollo-cli')
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.yml')
const CONFIG_BAK = path.join(TEST_DATA_DIR, 'original.config.yml.bak')

function renameFile(src: string, dest: string, verbose = true) {
  if (fs.existsSync(dest)) {
    throw new Error(`File ${dest} already exists`)
  }
  let msg = ''
  if (fs.existsSync(src)) {
    fs.renameSync(src, dest)
    msg = `mv ${src} ${dest}`
  } else {
    msg = `${src} does not exist`
  }
  if (verbose) {
    process.stdout.write(`${msg}\n`)
  }
}

export function copyFile(src: string, dest: string, verbose: boolean) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
  if (verbose) {
    const msg = `cp ${src} ${dest}`
    process.stdout.write(`${msg} # Copied: ${fs.existsSync(dest)}\n`)
  }
}

export function mochaGlobalSetup() {
  process.stdout.write(`Temporarily remove config file ${CONFIG_FILE} if any`)
  renameFile(CONFIG_FILE, CONFIG_BAK, VERBOSE)
}

export function mochaGlobalTeardown() {
  process.stdout.write(`Putting back config file ${CONFIG_FILE} if any\n`)
  renameFile(CONFIG_BAK, CONFIG_FILE, VERBOSE)
}
