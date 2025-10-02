import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { supabaseServer } from '@/lib/server-utils'
import { encryptObject } from '@/lib/encryption'

export interface GoogleSheetsConfig {
  sheetId: string
  sheetName?: string
  range?: string
  includeHeaders?: boolean
  maxRows?: number
}

export interface GoogleSheetsData {
  headers: string[]
  rows: (string | number | boolean | null)[][]
  metadata: {
    sheetName: string
    rowCount: number
    columnCount: number
    lastModified: string
  }
}

export interface GoogleSheetsSchema {
  tables: Array<{
    name: string
    type: 'table'
    columns: Array<{
      name: string
      type: string
      nullable: boolean
      sample_values: string[]
      ai_definition?: any
    }>
    row_count: number
    ai_definition?: any
  }>
  ai_definition?: any
}

export class GoogleSheetsConnector {
  private oauth2Client: OAuth2Client
  private sheets: any

  constructor(accessToken: string, refreshToken?: string) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    })

    this.sheets = google.sheets({ version: 'v4', auth: this.oauth2Client })
  }

  /**
   * Fetch data from Google Sheets
   */
  async fetchSheetData(config: GoogleSheetsConfig): Promise<GoogleSheetsData> {
    try {
      const range = config.range || `${config.sheetName || 'Sheet1'}!A:Z`
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: config.sheetId,
        range: range,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING'
      })

      const values = response.data.values || []
      
      if (values.length === 0) {
        throw new Error('No data found in the specified range')
      }

      // Determine headers
      const headers = config.includeHeaders !== false ? values[0] : 
        Array.from({ length: values[0]?.length || 0 }, (_, i) => `Column_${i + 1}`)
      
      // Get data rows (skip header if included)
      const dataRows = config.includeHeaders !== false ? values.slice(1) : values
      
      // Limit rows if specified
      const limitedRows = config.maxRows ? dataRows.slice(0, config.maxRows) : dataRows

      // Get sheet metadata
      const metadataResponse = await this.sheets.spreadsheets.get({
        spreadsheetId: config.sheetId,
        includeGridData: false
      })

      const sheet = metadataResponse.data.sheets?.find((s: any) => 
        s.properties?.title === config.sheetName || s.properties?.title === 'Sheet1'
      )

      return {
        headers,
        rows: limitedRows,
        metadata: {
          sheetName: sheet?.properties?.title || config.sheetName || 'Sheet1',
          rowCount: limitedRows.length,
          columnCount: headers.length,
          lastModified: metadataResponse.data.properties?.modifiedTime || new Date().toISOString()
        }
      }

    } catch (error) {
      console.error('Error fetching Google Sheets data:', error)
      throw new Error(`Failed to fetch Google Sheets data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate schema from Google Sheets data
   */
  generateSchema(data: GoogleSheetsData, sheetName: string): GoogleSheetsSchema {
    const columns = data.headers.map((header, index) => {
      // Get sample values for this column
      const sampleValues = data.rows
        .slice(0, 10) // Get first 10 rows as samples
        .map(row => row[index])
        .filter(value => value !== null && value !== undefined && value !== '')
        .map(value => String(value))

      // Determine column type based on sample data
      const columnType = this.determineColumnType(sampleValues)

      return {
        name: header,
        type: columnType,
        nullable: true, // Google Sheets columns are generally nullable
        sample_values: sampleValues,
        ai_definition: undefined // Will be populated by AI generation
      }
    })

    return {
      tables: [{
        name: sheetName,
        type: 'table',
        columns,
        row_count: data.metadata.rowCount,
        ai_definition: undefined // Will be populated by AI generation
      }],
      ai_definition: undefined // Will be populated by AI generation
    }
  }

  /**
   * Determine column type based on sample data
   */
  private determineColumnType(sampleValues: string[]): string {
    if (sampleValues.length === 0) return 'text'

    // Check for numbers
    const numberCount = sampleValues.filter(value => !isNaN(Number(value)) && value.trim() !== '').length
    if (numberCount / sampleValues.length > 0.8) return 'number'

    // Check for dates
    const dateCount = sampleValues.filter(value => {
      const date = new Date(value)
      return !isNaN(date.getTime()) && value.includes('/') || value.includes('-')
    }).length
    if (dateCount / sampleValues.length > 0.8) return 'date'

    // Check for booleans
    const booleanCount = sampleValues.filter(value => 
      ['true', 'false', 'yes', 'no', '1', '0'].includes(value.toLowerCase())
    ).length
    if (booleanCount / sampleValues.length > 0.8) return 'boolean'

    // Check for URLs
    const urlCount = sampleValues.filter(value => 
      value.startsWith('http://') || value.startsWith('https://')
    ).length
    if (urlCount / sampleValues.length > 0.5) return 'url'

    // Default to text
    return 'text'
  }

  /**
   * Store Google Sheets data in database
   */
  async storeSheetData(
    connectionId: string, 
    data: GoogleSheetsData, 
    schema: GoogleSheetsSchema
  ): Promise<void> {
    try {
      // Clear existing data for this connection
      await supabaseServer
        .from('spreadsheet_data')
        .delete()
        .eq('connection_id', connectionId)

      // Store new data
      const rowsToInsert: any[] = []
      
      // Insert headers as row 0
      data.headers.forEach((header, colIndex) => {
        rowsToInsert.push({
          connection_id: connectionId,
          sheet_name: data.metadata.sheetName,
          row_index: 0,
          column_index: colIndex,
          cell_value_encrypted: encryptObject({ value: header }),
          cell_type: 'text',
          is_header: true
        })
      })

      // Insert data rows
      data.rows.forEach((row, rowIndex) => {
        row.forEach((cellValue, colIndex) => {
          if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
            const column = schema.tables[0].columns[colIndex]
            rowsToInsert.push({
              connection_id: connectionId,
              sheet_name: data.metadata.sheetName,
              row_index: rowIndex + 1, // +1 because headers are row 0
              column_index: colIndex,
              cell_value_encrypted: encryptObject({ value: String(cellValue) }),
              cell_type: column?.type || 'text',
              is_header: false
            })
          }
        })
      })

      // Batch insert (Supabase has a limit, so we might need to chunk)
      const chunkSize = 1000
      for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
        const chunk = rowsToInsert.slice(i, i + chunkSize)
        const { error } = await supabaseServer
          .from('spreadsheet_data')
          .insert(chunk)

        if (error) {
          console.error('Error inserting spreadsheet data chunk:', error)
          throw error
        }
      }

      console.log(`✅ Stored ${rowsToInsert.length} spreadsheet cells for connection ${connectionId}`)

    } catch (error) {
      console.error('Error storing Google Sheets data:', error)
      throw error
    }
  }

  /**
   * Get OAuth authorization URL
   */
  static getAuthUrl(): string {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/drive.readonly'
    ]

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    })
  }

  /**
   * Exchange authorization code for tokens
   */
  static async exchangeCodeForTokens(code: string): Promise<{
    access_token: string
    refresh_token: string
    expires_in: number
  }> {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    const { tokens } = await oauth2Client.getToken(code)
    
    if (!tokens.access_token) {
      throw new Error('Failed to get access token')
    }

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || '',
      expires_in: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<string> {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken()
      
      if (!credentials.access_token) {
        throw new Error('Failed to refresh access token')
      }

      this.oauth2Client.setCredentials(credentials)
      return credentials.access_token

    } catch (error) {
      console.error('Error refreshing access token:', error)
      throw new Error('Failed to refresh access token')
    }
  }
}
