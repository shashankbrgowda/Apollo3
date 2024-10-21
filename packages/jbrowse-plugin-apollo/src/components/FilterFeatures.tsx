import React, { useState } from 'react'
import { ApolloSessionModel } from '../session'
import { Dialog } from './Dialog'
import {
  Box,
  Button,
  Chip,
  DialogContent,
  DialogContentText,
  Grid,
  TextField,
} from '@mui/material'
import { isOntologyClass } from '../OntologyManager'
import { OntologyTermAutocomplete } from './OntologyTermAutocomplete'
import { observer } from 'mobx-react'

interface FilterFeaturesProps {
  onUpdate: (types: string[]) => void
  featureTypes: string[]
  handleClose: () => void
  session: ApolloSessionModel
}

export const FilterFeatures = observer(function FilterFeatures({
  featureTypes,
  handleClose,
  onUpdate,
  session,
}: FilterFeaturesProps) {
  const [type, setType] = useState('')
  const [selectedFeatureTypes, setSelectedFeatureTypes] =
    useState<string[]>(featureTypes)
  const handleChange = (value: string): void => {
    setType(value)
  }
  const handleAddFeatureType = () => {
    if (type) {
      if (selectedFeatureTypes.includes(type)) {
        return
      }
      onUpdate([...selectedFeatureTypes, type])
      setSelectedFeatureTypes([...selectedFeatureTypes, type])
    }
  }
  const handleFeatureTypeDelete = (value: string) => {
    const newTypes = selectedFeatureTypes.filter((type) => type !== value)
    onUpdate(newTypes)
    setSelectedFeatureTypes(newTypes)
  }

  return (
    <Dialog
      open
      maxWidth={false}
      data-testid="filter-features-dialog"
      title="Filter features by type"
      handleClose={handleClose}
    >
      <DialogContent>
        <DialogContentText>
          Select the feature types you want to display in the apollo track
        </DialogContentText>
        <Grid container spacing={2}>
          <Grid item xs={7}>
            <OntologyTermAutocomplete
              session={session}
              ontologyName="Sequence Ontology"
              style={{ width: '100%' }}
              value={type}
              filterTerms={isOntologyClass}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Feature type"
                  variant="outlined"
                  fullWidth
                />
              )}
              onChange={(oldValue, newValue) => {
                if (newValue) {
                  handleChange(newValue)
                }
              }}
            />
          </Grid>
          <Grid item xs={5}>
            <Button
              variant="contained"
              onClick={handleAddFeatureType}
              disabled={!type}
              style={{ marginTop: 9 }}
              size="medium"
            >
              Add
            </Button>
          </Grid>
        </Grid>
        {selectedFeatureTypes.length > 0 && (
          <div style={{ width: 300 }}>
            <hr />
            <DialogContentText>Selected feature types:</DialogContentText>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {selectedFeatureTypes.map((value) => (
                <Chip
                  key={value}
                  label={value}
                  onDelete={() => {
                    handleFeatureTypeDelete(value)
                  }}
                />
              ))}
            </Box>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
})
