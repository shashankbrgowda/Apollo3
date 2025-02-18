// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// For Cypress v12.17.3 and older:
import compareSnapshotCommand from 'cypress-image-diff-js'
compareSnapshotCommand()

// Import commands.js using ES2015 syntax:
import './commands'

// Alternatively you can use CommonJS syntax:
// require('./commands')
import { addCommands } from 'cypress-mongodb/dist/index-browser'

addCommands()

// Cypress.on('uncaught:exception', (err, _runnable) => {
//   if (err.message.includes('ResizeObserver')) {
//     return false
//   }
// })
