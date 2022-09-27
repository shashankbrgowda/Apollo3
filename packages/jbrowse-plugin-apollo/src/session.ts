import { AssemblyModel } from '@jbrowse/core/assemblyManager/assembly'
import { getConf } from '@jbrowse/core/configuration'
import { AbstractSessionModel, AppRootModel, Region } from '@jbrowse/core/util'
import {
  AnnotationFeature,
  AnnotationFeatureI,
  AnnotationFeatureSnapshot,
  ApolloAssembly,
  ApolloRefSeq,
} from 'apollo-mst'
import {
  BackendDriver,
  ChangeManager,
  ClientDataStore as ClientDataStoreType,
  CollaborationServerDriver,
  CoreValidation,
  ValidationSet,
} from 'apollo-shared'
import {
  IAnyModelType,
  Instance,
  flow,
  getParentOfType,
  getRoot,
  resolveIdentifier,
  types,
} from 'mobx-state-tree'

import { ApolloInternetAccountModel } from './ApolloInternetAccount/model'

export interface ApolloSession extends AbstractSessionModel {
  apolloDataStore: ClientDataStoreType
  apolloSelectedFeature?: AnnotationFeatureI
  apolloSetSelectedFeature(feature?: AnnotationFeatureI): void
}

interface ApolloAssemblyResponse {
  _id: string
  name: string
  displayName?: string
  description?: string
  aliases?: string[]
}

interface ApolloRefSeqResponse {
  _id: string
  name: string
  description?: string
  length: string
  assembly: string
}

const ClientDataStore = types
  .model('ClientDataStore', {
    typeName: types.optional(types.literal('Client'), 'Client'),
    assemblies: types.map(ApolloAssembly),
    backendDriverType: types.optional(
      types.enumeration('backendDriverType', ['CollaborationServerDriver']),
      'CollaborationServerDriver',
    ),
    internetAccountConfigId: types.maybe(types.string),
  })
  .views((self) => ({
    get internetAccounts() {
      return (getRoot(self) as AppRootModel).internetAccounts
    },
    getFeature(featureId: string) {
      return resolveIdentifier(AnnotationFeature, self.assemblies, featureId)
    },
  }))
  .actions((self) => ({
    loadFeatures: flow(function* loadFeatures(regions: Region[]) {
      for (const region of regions) {
        const features = (yield (
          self as unknown as { backendDriver: BackendDriver }
        ).backendDriver.getFeatures(region)) as AnnotationFeatureSnapshot[]
        if (!features.length) {
          return
        }
        const { assemblyName, refName } = region
        let assembly = self.assemblies.get(assemblyName)
        if (!assembly) {
          assembly = self.assemblies.put({ _id: assemblyName, refSeqs: {} })
        }
        const [firstFeature] = features
        let ref = assembly.refSeqs.get(firstFeature.refSeq)
        if (!ref) {
          ref = assembly.refSeqs.put({
            _id: firstFeature.refSeq,
            name: refName,
            features: {},
          })
        }
        const newFeatures: Record<string, AnnotationFeatureSnapshot> = {}
        features.forEach((feature) => {
          newFeatures[feature._id] = feature
        })
        ref.features.merge(newFeatures)
      }
    }),
    addFeature(assemblyId: string, feature: AnnotationFeatureSnapshot) {
      const assembly = self.assemblies.get(assemblyId)
      if (!assembly) {
        throw new Error(
          `Could not find assembly "${assemblyId}" to add feature "${feature._id}"`,
        )
      }
      const ref = assembly.refSeqs.get(feature.refSeq)
      if (!ref) {
        throw new Error(
          `Could not find refSeq "${feature.refSeq}" to add feature "${feature._id}"`,
        )
      }
      ref.features.put(feature)
    },
    deleteFeature(featureId: string) {
      const feature = self.getFeature(featureId)
      if (!feature) {
        throw new Error(`Could not find feature "${featureId}" to delete`)
      }
      const { parent } = feature
      if (parent) {
        parent.deleteChild(featureId)
      } else {
        const refSeq = getParentOfType(feature, ApolloRefSeq)
        refSeq.deleteFeature(feature._id)
      }
    },
  }))
  .volatile((self) => ({
    changeManager: new ChangeManager(
      self as unknown as ClientDataStoreType,
      new ValidationSet([new CoreValidation()]),
    ),
  }))
  .volatile((self) => {
    if (self.backendDriverType !== 'CollaborationServerDriver') {
      throw new Error(`Unknown backend driver type "${self.backendDriverType}"`)
    }
    return {
      backendDriver: new CollaborationServerDriver(self),
    }
  })

export function extendSession(sessionModel: IAnyModelType) {
  const aborter = new AbortController()
  const { signal } = aborter
  return sessionModel
    .props({
      apolloDataStore: types.optional(ClientDataStore, { typeName: 'Client' }),
      apolloSelectedFeature: types.maybe(types.reference(AnnotationFeature)),
    })
    .actions((self) => ({
      apolloSetSelectedFeature(feature?: AnnotationFeatureI) {
        self.apolloSelectedFeature = feature
      },
      addApolloTrackConfig(assembly: AssemblyModel) {
        const trackId = `apollo_track_${assembly.name}`
        const hasTrack = Boolean(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          self.tracks.find((track: any) => track.trackId === trackId),
        )
        if (!hasTrack) {
          self.addTrackConf({
            type: 'ApolloTrack',
            trackId,
            name: `Annotations (${
              getConf(assembly, 'displayName') || assembly.name
            })`,
            assemblyNames: [assembly.name],
            displays: [
              {
                type: 'LinearApolloDisplay',
                displayId: `apollo_track_${assembly.name}-LinearApolloDisplay`,
              },
            ],
          })
        }
      },
      afterCreate: flow(function* afterCreate() {
        const { internetAccounts } = getRoot(self) as AppRootModel
        for (const internetAccount of internetAccounts as ApolloInternetAccountModel[]) {
          const { baseURL } = internetAccount
          const uri = new URL('assemblies', baseURL).href
          const fetch = internetAccount.getFetcher({
            locationType: 'UriLocation',
            uri,
          })
          let response: Response
          try {
            response = yield fetch(uri, { signal })
          } catch (e) {
            console.error(e)
            // setError(e instanceof Error ? e : new Error(String(e)))
            continue
          }
          if (!response.ok) {
            let errorMessage
            try {
              errorMessage = yield response.text()
            } catch (e) {
              errorMessage = ''
            }
            console.error(
              `Failed to fetch assemblies — ${response.status} (${
                response.statusText
              })${errorMessage ? ` (${errorMessage})` : ''}`,
            )
            continue
          }
          let fetchedAssemblies
          try {
            fetchedAssemblies =
              (yield response.json()) as ApolloAssemblyResponse[]
          } catch (e) {
            console.error(e)
            continue
          }
          for (const assembly of fetchedAssemblies) {
            const { assemblyManager } = self
            const selectedAssembly = assemblyManager.get(assembly.name)
            if (selectedAssembly) {
              self.addApolloTrackConfig(selectedAssembly)
              continue
            }
            const searchParams = new URLSearchParams({
              assembly: assembly._id,
            })
            const uri2 = new URL(`refSeqs?${searchParams.toString()}`, baseURL)
              .href
            const fetch2 = internetAccount.getFetcher({
              locationType: 'UriLocation',
              uri: uri2,
            })
            const response2 = (yield fetch2(uri2, {
              signal,
            })) as unknown as Response
            if (!response2.ok) {
              let errorMessage
              try {
                errorMessage = yield response2.text()
              } catch (e) {
                errorMessage = ''
              }
              throw new Error(
                `Failed to fetch fasta info — ${response2.status} (${
                  response2.statusText
                })${errorMessage ? ` (${errorMessage})` : ''}`,
              )
            }
            const f = (yield response2.json()) as ApolloRefSeqResponse[]
            const refNameAliasesFeatures = f.map((contig) => ({
              refName: contig.name,
              aliases: [contig._id],
              uniqueId: `alias-${contig._id}`,
            }))
            const assemblyConfig = {
              name: assembly._id,
              aliases: [assembly.name, ...(assembly.aliases || [])],
              displayName: assembly.displayName || assembly.name,
              sequence: {
                trackId: `sequenceConfigId-${assembly.name}`,
                type: 'ReferenceSequenceTrack',
                adapter: {
                  type: 'ApolloSequenceAdapter',
                  assemblyId: assembly._id,
                  baseURL,
                },
                metadata: {
                  internetAccountConfigId:
                    internetAccount.configuration.internetAccountId,
                },
              },
              refNameAliases: {
                adapter: {
                  type: 'FromConfigAdapter',
                  features: refNameAliasesFeatures,
                },
              },
            }
            self.addAssembly?.(assemblyConfig)
            const a = yield assemblyManager.waitForAssembly(assemblyConfig.name)
            self.addApolloTrackConfig(a)
          }
        }
      }),
      beforeDestroy() {
        aborter.abort()
      },
    }))
}

export type ApolloSessionStateModel = ReturnType<typeof extendSession>
export type ApolloSessionModel = Instance<ApolloSessionStateModel>