import gff, { GFF3Feature } from '@gmod/gff'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import {
  Assembly,
  AssemblyDocument,
  Feature,
  FeatureDocument,
  RefSeq,
  RefSeqDocument,
} from 'apollo-schemas'
import { Model } from 'mongoose'

import { FeatureRangeSearchDto } from '../entity/gff3Object.dto'

function makeGFF3Feature(
  featureDocument: Feature,
  parentId?: string,
): GFF3Feature {
  const locations = featureDocument.discontinuousLocations?.length
    ? featureDocument.discontinuousLocations
    : [{ start: featureDocument.start, end: featureDocument.end }]
  const attributes: Record<string, string[]> = {
    ...(featureDocument.attributes || {}),
  }
  const source = featureDocument.attributes?.source?.[0] || null
  delete attributes.source
  if (parentId) {
    attributes.Parent = [parentId]
  }
  if (attributes.id) {
    attributes.ID = attributes.id
    delete attributes.id
  }
  if (attributes.name) {
    attributes.Name = attributes.name
    delete attributes.name
  }
  if (attributes.note) {
    attributes.Note = attributes.note
    delete attributes.note
  }
  if (attributes.target) {
    attributes.Target = attributes.target
    delete attributes.target
  }
  return locations.map((location) => ({
    start: location.start,
    end: location.end,
    seq_id: featureDocument.refName,
    source,
    type: featureDocument.type,
    score: featureDocument.score || null,
    strand: featureDocument.strand
      ? featureDocument.strand === 1
        ? '+'
        : '-'
      : null,
    phase: featureDocument.phase ? String(featureDocument.phase) : null,
    attributes: Object.keys(attributes).length ? attributes : null,
    derived_features: [],
    child_features: featureDocument.children
      ? Object.values(featureDocument.children).map((child) =>
          makeGFF3Feature(child, attributes.ID[0]),
        )
      : [],
  }))
}

@Injectable()
export class FeaturesService {
  constructor(
    @InjectModel(Feature.name)
    private readonly featureModel: Model<FeatureDocument>,
    @InjectModel(Assembly.name)
    private readonly assemblyModel: Model<AssemblyDocument>,
    @InjectModel(RefSeq.name)
    private readonly refSeqModel: Model<RefSeqDocument>,
  ) {}

  private readonly logger = new Logger(FeaturesService.name)

  findAll() {
    return this.featureModel.find().exec()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async exportGFF3(assembly: string): Promise<any> {
    const refSeqs = await this.refSeqModel.find({ assembly }).exec()
    const refSeqIds = refSeqs.map((refSeq) => refSeq._id)
    const query = { refSeq: { $in: refSeqIds } }
    return this.featureModel
      .find(query)
      .cursor({
        transform: (chunk: FeatureDocument): GFF3Feature => {
          const flattened = chunk.toObject({ flattenMaps: true })
          return makeGFF3Feature(flattened)
        },
      })
      .pipe(gff.formatStream({ insertVersionDirective: true }))
  }

  /**
   * Get feature by featureId. When retrieving features by id, the features and any of its children are returned, but not any of its parent or sibling features.
   * @param featureId - featureId
   * @returns Return the feature(s) if search was successful. Otherwise throw exception
   */
  async findById(featureId: string) {
    // Search correct feature
    const topLevelFeature = await this.featureModel
      .findOne({ allIds: featureId })
      .exec()

    if (!topLevelFeature) {
      const errMsg = `ERROR: The following featureId was not found in database ='${featureId}'`
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }

    // Now we need to find correct top level feature or sub-feature inside the feature
    const foundFeature = this.getFeatureFromId(topLevelFeature, featureId)
    if (!foundFeature) {
      const errMsg = `ERROR when searching feature by featureId`
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }
    this.logger.debug(`Feature found: ${JSON.stringify(foundFeature)}`)
    return foundFeature
  }

  /**
   * Get single feature by featureId
   * @param featureOrDocument -
   * @param featureId -
   * @returns
   */
  getFeatureFromId(feature: Feature, featureId: string): Feature | null {
    this.logger.verbose(`Entry=${JSON.stringify(feature)}`)

    if (feature._id.equals(featureId)) {
      this.logger.debug(
        `Top level featureId matches in object ${JSON.stringify(feature)}`,
      )
      return feature
    }
    // Check if there is also childFeatures in parent feature and it's not empty
    // Let's get featureId from recursive method
    this.logger.debug(
      `FeatureId was not found on top level so lets make recursive call...`,
    )
    for (const [, childFeature] of feature.children || new Map()) {
      const subFeature = this.getFeatureFromId(childFeature, featureId)
      if (subFeature) {
        return subFeature
      }
    }
    return null
  }

  /**
   * Fetch features based on Reference seq, Start and End -values
   * @param request - Contain search criteria i.e. refname, start and end -parameters
   * @returns Return 'HttpStatus.OK' and array of features if search was successful
   * or if search data was not found or in case of error throw exception
   */
  async findByRange(searchDto: FeatureRangeSearchDto) {
    // Search feature
    const features = await this.featureModel
      .find({
        refSeq: searchDto.refSeq,
        start: { $lte: searchDto.end },
        end: { $gte: searchDto.start },
      })
      .exec()
    this.logger.debug(
      `Searching features for refSeq: ${searchDto.refSeq}, start: ${searchDto.start}, end: ${searchDto.end}`,
    )

    this.logger.verbose(
      `The following feature(s) matched  = ${JSON.stringify(features)}`,
    )
    return features
  }
}
