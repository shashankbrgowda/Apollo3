import {
  AssemblySpecificChange,
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedAssemblySpecificChange,
  ServerDataStore,
} from 'apollo-common'

export interface SerializedAddAssemblyFromFileChangeBase
  extends SerializedAssemblySpecificChange {
  typeName: 'AddAssemblyFromFileChange'
}

export interface AddAssemblyFromFileChangeDetails {
  assemblyName: string
  fileId: string
}

export interface SerializedAddAssemblyFromFileChangeSingle
  extends SerializedAddAssemblyFromFileChangeBase,
    AddAssemblyFromFileChangeDetails {}

export interface SerializedAddAssemblyFromFileChangeMultiple
  extends SerializedAddAssemblyFromFileChangeBase {
  changes: AddAssemblyFromFileChangeDetails[]
}

export type SerializedAddAssemblyFromFileChange =
  | SerializedAddAssemblyFromFileChangeSingle
  | SerializedAddAssemblyFromFileChangeMultiple

export class AddAssemblyFromFileChange extends AssemblySpecificChange {
  typeName = 'AddAssemblyFromFileChange' as const
  changes: AddAssemblyFromFileChangeDetails[]

  constructor(
    json: SerializedAddAssemblyFromFileChange,
    options?: ChangeOptions,
  ) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  get notification(): string {
    return `Assembly "${this.changes[0].assemblyName}" added successfully. To use it, please refresh the page.`
  }

  toJSON(): SerializedAddAssemblyFromFileChange {
    const { changes, typeName, assembly } = this
    if (changes.length === 1) {
      const [{ fileId, assemblyName }] = changes
      return { typeName, assembly, assemblyName, fileId }
    }
    return { typeName, assembly, changes }
  }

  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async executeOnServer(backend: ServerDataStore) {
    const { assemblyModel, fileModel, user } = backend
    const { changes, assembly, logger } = this

    for (const change of changes) {
      const { fileId, assemblyName } = change

      const { FILE_UPLOAD_FOLDER } = process.env
      if (!FILE_UPLOAD_FOLDER) {
        throw new Error('No FILE_UPLOAD_FOLDER found in .env file')
      }
      // Get file checksum
      const fileDoc = await fileModel.findById(fileId).exec()
      if (!fileDoc) {
        throw new Error(`File "${fileId}" not found in Mongo`)
      }
      logger.debug?.(`FileId "${fileId}", checksum "${fileDoc.checksum}"`)

      // Check and add new assembly
      const assemblyDoc = await assemblyModel
        .findOne({ name: assemblyName })
        .exec()
      if (assemblyDoc) {
        throw new Error(`Assembly "${assemblyName}" already exists`)
      }
      // Add assembly
      const [newAssemblyDoc] = await assemblyModel.create([
        { _id: assembly, name: assemblyName, user, status: -1 },
      ])
      logger.debug?.(
        `Added new assembly "${assemblyName}", docId "${newAssemblyDoc._id}"`,
      )
      logger.debug?.(
        `File type: "${fileDoc.type}", assemblyId: "${newAssemblyDoc._id}"`,
      )

      // Add refSeqs
      // We cannot use Mongo 'session' / transaction here because Mongo has 16 MB limit for transaction
      await this.addRefSeqIntoDb(fileDoc, newAssemblyDoc._id, backend)
    }
  }

  async executeOnLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async executeOnClient(dataStore: ClientDataStore) {}

  getInverse() {
    const { typeName, changes, assembly, logger } = this
    return new AddAssemblyFromFileChange(
      { typeName, changes, assembly },
      { logger },
    )
  }
}