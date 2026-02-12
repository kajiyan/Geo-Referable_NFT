import { OperationDefinitionNode, VariableDefinitionNode } from 'graphql'
import { SEARCH_TOKENS_BY_H3, SEARCH_RECENT_MINTS_BY_H3, GET_H3_CELL_DETAILS } from '../queries'

describe('GraphQL Queries', () => {
  describe('SEARCH_TOKENS_BY_H3', () => {
    it('should be a valid GraphQL query', () => {
      expect(SEARCH_TOKENS_BY_H3).toEqual(expect.objectContaining({
        kind: 'Document',
        definitions: expect.any(Array)
      }))
    })

    it('should have the correct query name', () => {
      const queryDefinition = SEARCH_TOKENS_BY_H3.definitions[0] as OperationDefinitionNode
      expect(queryDefinition.kind).toBe('OperationDefinition')
      expect(queryDefinition.name?.value).toBe('SearchTokensByH3')
    })

    it('should have the required variables', () => {
      const queryDefinition = SEARCH_TOKENS_BY_H3.definitions[0] as OperationDefinitionNode
      const variables = queryDefinition.variableDefinitions
      
      const variableNames = variables?.map((v: VariableDefinitionNode) => v.variable.name.value)
      expect(variableNames).toContain('h3r7')
      expect(variableNames).toContain('h3r9')
      expect(variableNames).toContain('h3r12')
      expect(variableNames).toContain('first')
    })

    it('should query for tokens at all three resolutions', () => {
      const queryString = SEARCH_TOKENS_BY_H3.loc?.source.body || ''
      
      expect(queryString).toContain('tokensByR7: tokens')
      expect(queryString).toContain('tokensByR9: tokens')
      expect(queryString).toContain('tokensByR12: tokens')
      expect(queryString).toContain('h3r7_in: $h3r7')
      expect(queryString).toContain('h3r9_in: $h3r9')
      expect(queryString).toContain('h3r12_in: $h3r12')
    })

    it('should include all required token fields', () => {
      const queryString = SEARCH_TOKENS_BY_H3.loc?.source.body || ''
      
      const requiredFields = [
        'id', 'tokenId', 'owner', 'latitude', 'longitude', 'elevation',
        'weather', 'tree', 'generation', 'h3r7', 'h3r9', 'h3r12',
        'text', 'createdAt', 'createdAtBlock'
      ]
      
      requiredFields.forEach(field => {
        expect(queryString).toContain(field)
      })
    })

    it('should include globalStats query', () => {
      const queryString = SEARCH_TOKENS_BY_H3.loc?.source.body || ''
      
      expect(queryString).toContain('globalStats')
      expect(queryString).toContain('totalTokens')
      expect(queryString).toContain('totalUsers')
      expect(queryString).toContain('totalTrees')
    })
  })

  describe('SEARCH_RECENT_MINTS_BY_H3', () => {
    it('should be a valid GraphQL query', () => {
      expect(SEARCH_RECENT_MINTS_BY_H3).toEqual(expect.objectContaining({
        kind: 'Document',
        definitions: expect.any(Array)
      }))
    })

    it('should have the correct query name', () => {
      const queryDefinition = SEARCH_RECENT_MINTS_BY_H3.definitions[0] as OperationDefinitionNode
      expect(queryDefinition.kind).toBe('OperationDefinition')
      expect(queryDefinition.name?.value).toBe('SearchRecentMintsByH3')
    })

    it('should query mintEvents with H3 filtering', () => {
      const queryString = SEARCH_RECENT_MINTS_BY_H3.loc?.source.body || ''
      
      expect(queryString).toContain('mintEvents')
      expect(queryString).toContain('h3r7_in: $h3r7')
      expect(queryString).toContain('orderBy: timestamp')
      expect(queryString).toContain('orderDirection: desc')
    })

    it('should include all required mintEvent fields', () => {
      const queryString = SEARCH_RECENT_MINTS_BY_H3.loc?.source.body || ''
      
      const requiredFields = [
        'id', 'tokenId', 'to', 'from', 'tree', 'generation',
        'h3r7', 'h3r9', 'h3r12', 'timestamp', 'blockNumber', 'transactionHash'
      ]
      
      requiredFields.forEach(field => {
        expect(queryString).toContain(field)
      })
    })
  })

  describe('GET_H3_CELL_DETAILS', () => {
    it('should be a valid GraphQL query', () => {
      expect(GET_H3_CELL_DETAILS).toEqual(expect.objectContaining({
        kind: 'Document',
        definitions: expect.any(Array)
      }))
    })

    it('should have the correct query name', () => {
      const queryDefinition = GET_H3_CELL_DETAILS.definitions[0] as OperationDefinitionNode
      expect(queryDefinition.kind).toBe('OperationDefinition')
      expect(queryDefinition.name?.value).toBe('GetH3CellDetails')
    })

    it('should filter by exact h3r12 value', () => {
      const queryString = GET_H3_CELL_DETAILS.loc?.source.body || ''
      
      expect(queryString).toContain('h3r12: $h3r12')
      expect(queryString).toContain('where: { h3r12: $h3r12 }')
    })

    it('should include detailed token fields', () => {
      const queryString = GET_H3_CELL_DETAILS.loc?.source.body || ''
      
      const detailedFields = [
        'quadrant', 'isBelowSeaLevel', 'textByteLength', 'textCharLength',
        'referringTo', 'referredBy', 'initialBaseTokenId',
        'createdAtTx', 'updatedAt'
      ]
      
      detailedFields.forEach(field => {
        expect(queryString).toContain(field)
      })
    })
  })

  describe('Query Validation', () => {
    it('should have consistent field selections across queries', () => {
      const searchQuery = SEARCH_TOKENS_BY_H3.loc?.source.body || ''
      const mintsQuery = SEARCH_RECENT_MINTS_BY_H3.loc?.source.body || ''
      
      // Common fields that should exist in both
      const commonFields = ['h3r7', 'h3r9', 'h3r12', 'tokenId']
      
      commonFields.forEach(field => {
        expect(searchQuery).toContain(field)
        expect(mintsQuery).toContain(field)
      })
    })

    it('should use proper GraphQL syntax', () => {
      const queries = [SEARCH_TOKENS_BY_H3, SEARCH_RECENT_MINTS_BY_H3, GET_H3_CELL_DETAILS]
      
      queries.forEach(query => {
        expect(query.kind).toBe('Document')
        expect(query.definitions).toHaveLength(1)
        expect(query.definitions[0].kind).toBe('OperationDefinition')
        expect((query.definitions[0] as OperationDefinitionNode).operation).toBe('query')
      })
    })
  })
})