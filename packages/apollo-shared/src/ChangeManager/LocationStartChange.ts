import { FeatureDocument } from 'apollo-schemas'
import { Feature } from 'apollo-schemas'

import {
  ChangeOptions,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
  ServerDataStore,
} from './Change'
import { FeatureChange } from './FeatureChange'

interface SerializedLocationStartChangeBase extends SerializedChange {
  typeName: 'LocationStartChange'
}

interface LocationStartChangeDetails {
  featureId: string
  oldStart: number
  newStart: number
}

interface SerializedLocationStartChangeSingle
  extends SerializedLocationStartChangeBase,
    LocationStartChangeDetails {}

interface SerializedLocationStartChangeMultiple
  extends SerializedLocationStartChangeBase {
  changes: LocationStartChangeDetails[]
}

type SerializedLocationStartChange =
  | SerializedLocationStartChangeSingle
  | SerializedLocationStartChangeMultiple

export class LocationStartChange extends FeatureChange {
  typeName = 'LocationStartChange' as const
  changes: LocationStartChangeDetails[]

  constructor(json: SerializedLocationStartChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedLocationStartChange {
    if (this.changes.length === 1) {
      const [{ featureId, oldStart, newStart }] = this.changes
      return {
        typeName: this.typeName,
        changedIds: this.changedIds,
        assemblyId: this.assemblyId,
        featureId,
        oldStart,
        newStart,
      }
    }
    return {
      typeName: this.typeName,
      changedIds: this.changedIds,
      assemblyId: this.assemblyId,
      changes: this.changes,
    }
  }

  /**
   * Applies the required change to database
   * @param backend - parameters from backend
   * @returns
   */
  async applyToServer(backend: ServerDataStore) {
    const { featureModel, session } = backend
    const { changes } = this
    const featuresForChanges: {
      feature: Feature
      topLevelFeature: FeatureDocument
    }[] = []
    // Let's first check that all features are found and those old values match with expected ones. We do this just to be sure that all changes can be done.
    for (const change of changes) {
      const { featureId, oldStart } = change

      // Search correct feature
      const topLevelFeature = await featureModel
        .findOne({ allIds: featureId })
        .session(session)
        .exec()

      if (!topLevelFeature) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${featureId}'`
        this.logger.error(errMsg)
        throw new Error(errMsg)
        // throw new NotFoundException(errMsg)  -- This is causing runtime error because Exception comes from @nestjs/common!!!
      }
      this.logger.debug?.(
        `*** Feature found: ${JSON.stringify(topLevelFeature)}`,
      )

      const foundFeature = this.getFeatureFromId(topLevelFeature, featureId)
      if (!foundFeature) {
        const errMsg = `ERROR when searching feature by featureId`
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }
      this.logger.debug?.(`*** Found feature: ${JSON.stringify(foundFeature)}`)
      if (foundFeature.start !== oldStart) {
        const errMsg = `*** ERROR: Feature's current start value ${topLevelFeature.start} doesn't match with expected value ${oldStart}`
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }
      featuresForChanges.push({
        feature: foundFeature,
        topLevelFeature,
      })
    }

    // Let's update objects.
    for (const [idx, change] of changes.entries()) {
      const { newStart } = change
      const { feature, topLevelFeature } = featuresForChanges[idx]
      feature.start = newStart
      if (topLevelFeature._id.equals(feature._id)) {
        topLevelFeature.markModified('start') // Mark as modified. Without this save() -method is not updating data in database
      } else {
        topLevelFeature.markModified('children') // Mark as modified. Without this save() -method is not updating data in database
      }

      try {
        await topLevelFeature.save()
      } catch (error) {
        this.logger.debug?.(`*** FAILED: ${error}`)
        throw error
      }
      this.logger.debug?.(
        `*** Object updated in Mongo. New object: ${JSON.stringify(
          topLevelFeature,
        )}`,
      )
    }
  }

  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('applyToLocalGFF3 not implemented')
  }

  async applyToClient(dataStore: ClientDataStore) {
    if (!dataStore) {
      throw new Error('No data store')
    }
    this.changedIds.forEach((changedId, idx) => {
      const feature = dataStore.getFeature(changedId)
      if (!feature) {
        throw new Error(`Could not find feature with identifier "${changedId}"`)
      }
      feature.setStart(this.changes[idx].newStart)
    })
  }

  getInverse() {
    const inverseChangedIds = this.changedIds.slice().reverse()
    const inverseChanges = this.changes
      .slice()
      .reverse()
      .map((startChange) => ({
        featureId: startChange.featureId,
        oldStart: startChange.newStart,
        newStart: startChange.oldStart,
      }))
    return new LocationStartChange(
      {
        changedIds: inverseChangedIds,
        typeName: this.typeName,
        changes: inverseChanges,
        assemblyId: this.assemblyId,
      },
      { logger: this.logger },
    )
  }
}

export function isLocationStartChange(
  change: unknown,
): change is LocationStartChange {
  return (change as LocationStartChange).typeName === 'LocationStartChange'
}
