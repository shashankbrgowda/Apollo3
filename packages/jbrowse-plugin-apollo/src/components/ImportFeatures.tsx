import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { getConf } from '@jbrowse/core/configuration'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Select,
  SelectChangeEvent,
} from '@mui/material'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import LinearProgress from '@mui/material/LinearProgress'
import { AddFeaturesFromFileChange } from 'apollo-shared'
import React, { useEffect, useState } from 'react'

import {
  ApolloInternetAccount,
  CollaborationServerDriver,
} from '../BackendDrivers'
import { ChangeManager } from '../ChangeManager'
import { ApolloSessionModel } from '../session'
import { createFetchErrorMessage } from '../util'

interface ImportFeaturesProps {
  session: ApolloSessionModel
  handleClose(): void
  changeManager: ChangeManager
}

export function ImportFeatures({
  session,
  handleClose,
  changeManager,
}: ImportFeaturesProps) {
  const { notify } = session

  const [file, setFile] = useState<File>()
  const [selectedAssembly, setSelectedAssembly] = useState<Assembly>()
  const [errorMessage, setErrorMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  // default is -1, submit button should be disabled until count is set
  const [featuresCount, setFeaturesCount] = useState(-1)
  const [deleteFeatures, setDeleteFeatures] = useState(false)
  const [loading, setLoading] = useState(false)

  const { collaborationServerDriver, getInternetAccount } =
    session.apolloDataStore as {
      collaborationServerDriver: CollaborationServerDriver
      getInternetAccount(
        assemblyName?: string,
        internetAccountId?: string,
      ): ApolloInternetAccount
    }
  const assemblies = collaborationServerDriver.getAssemblies()

  function handleChangeAssembly(e: SelectChangeEvent<string>) {
    const newAssembly = assemblies.find((asm) => asm.name === e.target.value)
    setSelectedAssembly(newAssembly)
    setSubmitted(false)
  }

  function handleDeleteFeatures(e: React.ChangeEvent<HTMLInputElement>) {
    setDeleteFeatures(e.target.checked)
  }

  // fetch and set features count for selected assembly
  useEffect(() => {
    if (!selectedAssembly) {
      return
    }
    const updateFeaturesCount = async () => {
      const { internetAccountConfigId } = getConf(selectedAssembly, [
        'sequence',
        'metadata',
      ]) as { internetAccountConfigId?: string }
      const apolloInternetAccount = getInternetAccount(internetAccountConfigId)
      if (!apolloInternetAccount) {
        throw new Error('No Apollo internet account found')
      }

      const { baseURL } = apolloInternetAccount
      const uri = new URL('/features/count', baseURL)
      const searchParams = new URLSearchParams({
        assemblyId: selectedAssembly.name,
      })
      uri.search = searchParams.toString()
      const fetch = apolloInternetAccount?.getFetcher({
        locationType: 'UriLocation',
        uri: uri.toString(),
      })

      if (fetch) {
        // sumbit might get enabled when we change assembly before loading features count
        setFeaturesCount(-1)
        setLoading(true)
        const response = await fetch(uri.toString(), { method: 'GET' })

        if (!response.ok) {
          setFeaturesCount(0)
        } else {
          const countObj = (await response.json()) as { count: number }
          setFeaturesCount(countObj.count)
        }

        setLoading(false)
      }
    }

    updateFeaturesCount().catch((err) => err)
  }, [getInternetAccount, selectedAssembly])

  function handleChangeFile(e: React.ChangeEvent<HTMLInputElement>) {
    setSubmitted(false)
    if (!e.target.files) {
      return
    }
    setFile(e.target.files[0])
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setLoading(true)
    setSubmitted(true)

    // let fileChecksum = ''
    let fileId = ''

    if (!file) {
      setErrorMessage('must select a file')
      return
    }

    if (!selectedAssembly) {
      setErrorMessage('Must select assembly to download')
      return
    }

    const { internetAccountConfigId } = getConf(selectedAssembly, [
      'sequence',
      'metadata',
    ]) as { internetAccountConfigId?: string }
    const apolloInternetAccount = getInternetAccount(internetAccountConfigId)
    const { baseURL } = apolloInternetAccount

    // First upload file
    const url = new URL('/files', baseURL).href
    const formData = new FormData()
    formData.append('file', file)
    formData.append('fileName', file.name)
    formData.append('type', 'text/x-gff3')
    const apolloFetchFile = apolloInternetAccount?.getFetcher({
      locationType: 'UriLocation',
      uri: url,
    })
    if (apolloFetchFile) {
      const response = await apolloFetchFile(url, {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        const newErrorMessage = await createFetchErrorMessage(
          response,
          'Error when inserting new features (while uploading file)',
        )
        setErrorMessage(newErrorMessage)
        return
      }
      const result = await response.json()
      // fileChecksum = result.checksum
      fileId = result._id
    }

    // Add features
    const change = new AddFeaturesFromFileChange({
      typeName: 'AddFeaturesFromFileChange',
      assembly: selectedAssembly.name,
      fileId,
      deleteExistingFeatures: deleteFeatures,
    })
    await changeManager.submit(change)
    notify(
      `Features are being added to "${
        selectedAssembly.displayName ?? selectedAssembly.name
      }"`,
      'info',
    )
    handleClose()
    event.preventDefault()
  }

  return (
    <Dialog open maxWidth="xs" data-testid="login-apollo" fullWidth={true}>
      <DialogTitle>Import Features from GFF3 file</DialogTitle>
      {loading ? <LinearProgress /> : null}

      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <DialogContentText>Select assembly</DialogContentText>
          <Select
            labelId="label"
            value={selectedAssembly?.name ?? ''}
            onChange={handleChangeAssembly}
            disabled={submitted && !errorMessage}
          >
            {assemblies.map((option) => (
              <MenuItem key={option.name} value={option.name}>
                {option.displayName ?? option.name}
              </MenuItem>
            ))}
          </Select>
        </DialogContent>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <DialogContentText>Upload GFF3 to load features</DialogContentText>
          <input
            type="file"
            onChange={handleChangeFile}
            disabled={submitted && !errorMessage}
          />
        </DialogContent>

        {featuresCount > 0 ? (
          <DialogContent>
            <DialogContentText>
              This assembly already has {featuresCount} features, would you like
              to delete the existing features before importing new ones?
            </DialogContentText>
            <FormControlLabel
              label="Yes, delete existing features"
              disabled={submitted && !errorMessage}
              control={
                <Checkbox
                  checked={deleteFeatures}
                  onChange={handleDeleteFeatures}
                  inputProps={{ 'aria-label': 'controlled' }}
                  color="warning"
                />
              }
            />
          </DialogContent>
        ) : null}

        <DialogActions>
          <Button
            disabled={
              !(selectedAssembly && file && featuresCount !== -1) || submitted
            }
            variant="contained"
            type="submit"
          >
            {submitted ? 'Submitting...' : 'Submit'}
          </Button>
          <Button
            disabled={submitted}
            variant="outlined"
            type="submit"
            onClick={() => {
              handleClose()
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </form>
      {errorMessage ? (
        <DialogContent>
          <DialogContentText color="error">{errorMessage}</DialogContentText>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
