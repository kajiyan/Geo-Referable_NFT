import { Token } from '../types'

export interface GenerationGroup {
  generation: string
  tokens: Token[]
  count: number
}

export interface GenerationProcessorResult {
  generations: GenerationGroup[]
  totalTokens: number
  generationRange: {
    min: number
    max: number
  }
  stats: {
    averageTokensPerGeneration: number
    generationsWithTokens: number
  }
}

export function groupTokensByGeneration(tokens: Token[]): Map<string, Token[]> {
  const generationGroups = new Map<string, Token[]>()
  
  tokens.forEach(token => {
    const gen = token.generation || '0'
    if (!generationGroups.has(gen)) {
      generationGroups.set(gen, [])
    }
    generationGroups.get(gen)!.push(token)
  })
  
  return generationGroups
}

export function sortGenerations(generationMap: Map<string, Token[]>): [string, Token[]][] {
  return Array.from(generationMap.entries())
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
}

export function processGenerationData(tokens: Token[]): GenerationProcessorResult {
  const generationMap = groupTokensByGeneration(tokens)
  const sortedGenerations = sortGenerations(generationMap)
  
  const generations: GenerationGroup[] = sortedGenerations.map(([generation, tokens]) => ({
    generation,
    tokens: tokens.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    count: tokens.length
  }))

  const generationNumbers = generations.map(g => parseInt(g.generation)).filter(n => !isNaN(n))
  const minGeneration = generationNumbers.length > 0 ? Math.min(...generationNumbers) : 0
  const maxGeneration = generationNumbers.length > 0 ? Math.max(...generationNumbers) : 0
  
  return {
    generations,
    totalTokens: tokens.length,
    generationRange: {
      min: minGeneration,
      max: maxGeneration
    },
    stats: {
      averageTokensPerGeneration: tokens.length / generations.length || 0,
      generationsWithTokens: generations.length
    }
  }
}

export function findTokenById(generations: GenerationGroup[], tokenId: string): Token | null {
  for (const generation of generations) {
    const token = generation.tokens.find(token => token.id === tokenId)
    if (token) return token
  }
  return null
}

export function getGenerationStats(generations: GenerationGroup[]) {
  return {
    totalGenerations: generations.length,
    totalTokens: generations.reduce((sum, gen) => sum + gen.count, 0),
    generationsData: generations.map(gen => ({
      generation: gen.generation,
      count: gen.count,
      percentage: 0 // Will be calculated after total is known
    }))
  }
}