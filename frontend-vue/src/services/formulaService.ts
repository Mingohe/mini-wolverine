import { appConfig, getApiUrl } from '@/config/env'

export interface FormulaFilters {
  languageId?: number
  pattern?: string
  privateOnly?: boolean
}

export interface FormulaData {
  id?: number
  name: string
  sourceCode: string
  languageId: number
  property?: string
  description?: string
}

export interface FormulaQueryResponse {
  success: boolean
  formulas: Array<{
    id: number
    name: string
    source_code: string
    language_id: number
    created_at: string
    updated_at: string
    owner_user_id: number
    is_public: boolean
    property?: string
    description?: string
  }>
  error?: string
}

export interface FormulaSaveResponse {
  success: boolean
  formula: {
    id: number
    name: string
    source_code: string
    language_id: number
    created_at: string
    updated_at: string
    owner_user_id: number
    is_public: boolean
    property?: string
    description?: string
  }
  error?: string
}

export interface FormulaDeleteResponse {
  success: boolean
  error?: string
}

export class FormulaService {
  /**
   * Query formulas with optional filters
   */
  async queryFormulas(filters?: FormulaFilters): Promise<FormulaQueryResponse> {
    const url = getApiUrl(appConfig.apiEndpoints.formulaQuery)
    const body: Record<string, any> = {
      // Default to private_only: 1 (only show private formulas)
      private_only: 1
    }

    if (filters?.languageId !== undefined) {
      body.language_id = filters.languageId
    }

    if (filters?.pattern) {
      body.pattern = filters.pattern
    }

    if (filters?.privateOnly !== undefined) {
      body.private_only = filters.privateOnly ? 1 : 0
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      throw new Error(`Failed to query formulas: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Save (create or update) a formula
   */
  async saveFormula(data: FormulaData): Promise<FormulaSaveResponse> {
    const url = getApiUrl(appConfig.apiEndpoints.formulaSave)
    const body: Record<string, any> = {
      name: data.name,
      source_code: data.sourceCode,
      language_id: data.languageId,
      property: data.property || '{"add_to_main":false}' // Default property
    }

    if (data.id && data.id > 0) {
      body.id = data.id
    }

    if (data.description) {
      body.description = data.description
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      throw new Error(`Failed to save formula: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Delete a formula by ID
   */
  async deleteFormula(id: number): Promise<FormulaDeleteResponse> {
    const url = getApiUrl(appConfig.apiEndpoints.formulaDelete)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id })
    })

    if (!response.ok) {
      throw new Error(`Failed to delete formula: ${response.statusText}`)
    }

    return response.json()
  }
}

export const formulaService = new FormulaService()
