// Pulled in from DefinitelyTyped because the published version there includes a
// dependency on an older @types/mongoose package.
// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/173aa9174685d78871a5c035b74d856f4aef9cc8/types/mongoose-id-validator/index.d.ts

interface MongooseIdValidatorOptions {
  /* Optional, custom validation message with {PATH} being replaced
   * with the relevant schema path that contains an invalid
   * document ID.
   */
  message?: string | undefined

  /* Optional, mongoose connection object to use if you are
   * using multiple connections in your application.
   *
   * Defaults to built-in mongoose connection if not specified.
   */
  connection?: import('mongoose').Connection | undefined

  /* Optional, applies to validation of arrays of ID references only. Set
   * to true if you sometimes have the same object ID reference
   * repeated in an array. If set, the validator will use the
   * total of unique ID references instead of total number of array
   * entries when checking the database.
   *
   * Defaults to false
   */
  allowDuplicates?: boolean | undefined
}

declare module 'mongoose-id-validator' {
  export default function mongooseIdValidator(
    schema: import('mongoose').Schema,
    options?: MongooseIdValidatorOptions,
  ): void
}

// Pulled in from DefinitelyTyped because the published version there is not up
// to date with connect-mongodb-session v3.
// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/34aaceacc735148d775a4c09db89afeb1cff6536/types/connect-mongodb-session/index.d.ts

declare module 'connect-mongodb-session' {
  import session = require('express-session')
  import { MongoClient, MongoClientOptions } from 'mongodb'

  declare function connectMongoDBSession(
    fn: typeof session,
  ): typeof ConnectMongoDBSession.MongoDBStore

  declare namespace ConnectMongoDBSession {
    class MongoDBStore extends session.Store {
      constructor(
        connection?: MongoDBSessionOptions,
        callback?: (error: Error) => void,
      )
      client: MongoClient

      get(
        sid: string,
        callback: (err: unknown, session?: session.SessionData | null) => void,
      ): void
      set(
        sid: string,
        session: session.SessionData,
        callback?: (err?: unknown) => void,
      ): void
      destroy(sid: string, callback?: (err?: unknown) => void): void
      all(
        callback: (
          err: unknown,
          obj?:
            | session.SessionData[]
            | { [sid: string]: session.SessionData }
            | null,
        ) => void,
      ): void
      clear(callback?: (err?: unknown) => void): void
    }

    interface MongoDBSessionOptions {
      uri: string
      collection: string
      expires?: number | undefined
      databaseName?: string | undefined
      connectionOptions?: MongoClientOptions | undefined
      idField?: string | undefined
      expiresKey?: string | undefined
      expiresAfterSeconds?: number | undefined
    }
  }

  export default connectMongoDBSession
}
