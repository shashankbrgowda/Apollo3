import { Instance, SnapshotIn, types } from 'mobx-state-tree'

import { AnnotationFeatureModel } from './AnnotationFeatureModel'

export const CheckResult = types.model('CheckResult', {
  _id: types.identifier,
  name: types.string,
  ids: types.array(types.safeReference(AnnotationFeatureModel)),
  refSeq: types.string,
  start: types.number,
  end: types.number,
  ignored: false,
  message: types.string,
})

export type CheckResultI = Instance<typeof CheckResult>
export type CheckResultSnapshot = SnapshotIn<typeof CheckResult>
