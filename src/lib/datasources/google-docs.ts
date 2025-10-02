import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { supabaseServer } from '@/lib/server-utils'
import { encryptObject } from '@/lib/encryption'

interface AIDefinition {
  description?: string
  business_purpose?: string
  key_entities?: string[]
  common_use_cases?: string[]
  data_quality_notes?: string
  [key: string]: unknown
}

interface SectionMetadata {
  level?: number
  style?: string
  [key: string]: unknown
}

export interface GoogleDocsConfig {
  documentId: string
  includeFormatting?: boolean
  maxSections?: number
}

export interface GoogleDocsData {
  title: string
  sections: Array<{
    title: string
    content: string
    type: 'heading' | 'paragraph' | 'list' | 'table' | 'image' | 'link' | 'code'
    order: number
    metadata: SectionMetadata
  }>
  metadata: {
    documentId: string
    lastModified: string
    wordCount: number
    sectionCount: number
  }
}

export interface GoogleDocsSchema {
  tables: Array<{
    name: string
    type: 'document'
    columns: Array<{
      name: string
      type: string
      nullable: boolean
      sample_values: string[]
      ai_definition?: AIDefinition
    }>
    row_count: number
    ai_definition?: AIDefinition
  }>
  ai_definition?: AIDefinition
}

export class GoogleDocsConnector {
  private oauth2Client: OAuth2Client
  private docs: ReturnType<typeof google.docs>

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

    this.docs = google.docs({ version: 'v1', auth: this.oauth2Client })
  }

  /**
   * Fetch document content from Google Docs
   */
  async fetchDocumentData(config: GoogleDocsConfig): Promise<GoogleDocsData> {
    try {
      const response = await this.docs.documents.get({
        documentId: config.documentId
      })

      const document = response.data
      const title = document.title || 'Untitled Document'
      
      // Parse document content into sections
      const sections = this.parseDocumentContent(document, config)
      
      // Calculate word count
      const wordCount = sections.reduce((count, section) => 
        count + section.content.split(/\s+/).length, 0
      )

      return {
        title,
        sections,
        metadata: {
          documentId: config.documentId,
          lastModified: (document as any).modifiedTime || new Date().toISOString(),
          wordCount,
          sectionCount: sections.length
        }
      }

    } catch (error) {
      console.error('Error fetching Google Docs data:', error)
      throw new Error(`Failed to fetch Google Docs data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Parse Google Docs content into structured sections
   */
  private parseDocumentContent(document: any, config: GoogleDocsConfig): Array<{
    title: string
    content: string
    type: 'heading' | 'paragraph' | 'list' | 'table' | 'image' | 'link' | 'code'
    order: number
    metadata: any
  }> {
    const sections: Array<{
      title: string
      content: string
      type: 'heading' | 'paragraph' | 'list' | 'table' | 'image' | 'link' | 'code'
      order: number
      metadata: any
    }> = []

    let sectionOrder = 0

    // Process document body content
    if (document.body?.content) {
      for (const element of document.body.content) {
        if (element.paragraph) {
          const paragraph = element.paragraph
          const text = this.extractTextFromParagraph(paragraph)
          
          if (text.trim()) {
            // Determine if this is a heading based on style
            const isHeading = this.isHeading(paragraph)
            const sectionType = isHeading ? 'heading' : 'paragraph'
            
            sections.push({
              title: isHeading ? text.substring(0, 100) : `Section ${sectionOrder + 1}`,
              content: text,
              type: sectionType,
              order: sectionOrder++,
              metadata: {
                style: paragraph.paragraphStyle,
                elements: paragraph.elements?.length || 0
              }
            })
          }
        } else if (element.table) {
          const table = element.table
          const tableContent = this.extractTableContent(table)
          
          if (tableContent.trim()) {
            sections.push({
              title: `Table ${sectionOrder + 1}`,
              content: tableContent,
              type: 'table',
              order: sectionOrder++,
              metadata: {
                rows: table.tableRows?.length || 0,
                columns: table.tableRows?.[0]?.tableCells?.length || 0
              }
            })
          }
        }
      }
    }

    // Limit sections if specified
    return config.maxSections ? sections.slice(0, config.maxSections) : sections
  }

  /**
   * Extract text content from a paragraph element
   */
  private extractTextFromParagraph(paragraph: any): string {
    if (!paragraph.elements) return ''

    return paragraph.elements
      .map((element: any) => {
        if (element.textRun) {
          return element.textRun.content || ''
        }
        return ''
      })
      .join('')
      .trim()
  }

  /**
   * Extract content from a table element
   */
  private extractTableContent(table: any): string {
    if (!table.tableRows) return ''

    return table.tableRows
      .map((row: any) => {
        if (!row.tableCells) return ''
        
        return row.tableCells
          .map((cell: any) => {
            if (!cell.content) return ''
            
            return cell.content
              .map((element: any) => {
                if (element.paragraph) {
                  return this.extractTextFromParagraph(element.paragraph)
                }
                return ''
              })
              .join('')
              .trim()
          })
          .join(' | ')
      })
      .join('\n')
  }

  /**
   * Determine if a paragraph is a heading
   */
  private isHeading(paragraph: any): boolean {
    const style = paragraph.paragraphStyle
    if (!style) return false

    // Check for heading styles
    const headingStyles = [
      'HEADING_1', 'HEADING_2', 'HEADING_3', 'HEADING_4', 'HEADING_5', 'HEADING_6'
    ]

    return headingStyles.includes(style.namedStyleType)
  }

  /**
   * Generate schema from Google Docs data
   */
  generateSchema(data: GoogleDocsData): GoogleDocsSchema {
    // Create columns based on section types
    const sectionTypes = [...new Set(data.sections.map(s => s.type))]
    
    const columns = sectionTypes.map(sectionType => {
      // Get sample content for this section type
      const sampleSections = data.sections
        .filter(s => s.type === sectionType)
        .slice(0, 5)
      
      const sampleValues = sampleSections.map(s => s.content.substring(0, 100))

      return {
        name: `${sectionType}_content`,
        type: 'text',
        nullable: true,
        sample_values: sampleValues,
        ai_definition: undefined
      }
    })

    // Add metadata columns
    columns.push(
      {
        name: 'section_title',
        type: 'text',
        nullable: true,
        sample_values: data.sections.slice(0, 5).map(s => s.title),
        ai_definition: undefined
      },
      {
        name: 'section_order',
        type: 'number',
        nullable: false,
        sample_values: data.sections.slice(0, 5).map(s => s.order.toString()),
        ai_definition: undefined
      }
    )

    return {
      tables: [{
        name: 'document_sections',
        type: 'document',
        columns,
        row_count: data.sections.length,
        ai_definition: undefined
      }],
      ai_definition: undefined
    }
  }

  /**
   * Store Google Docs data in database
   */
  async storeDocumentData(
    connectionId: string, 
    data: GoogleDocsData, 
    _schema: GoogleDocsSchema
  ): Promise<void> {
    try {
      // Clear existing data for this connection
      await supabaseServer
        .from('document_content')
        .delete()
        .eq('connection_id', connectionId)

      // Store new data
      const rowsToInsert = data.sections.map(section => ({
        connection_id: connectionId,
        section_title: section.title,
        section_content_encrypted: encryptObject({ content: section.content }),
        section_type: section.type,
        section_order: section.order,
        metadata: section.metadata,
        word_count: section.content.split(/\s+/).length
      }))

      // Batch insert
      const chunkSize = 1000
      for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
        const chunk = rowsToInsert.slice(i, i + chunkSize)
        const { error } = await supabaseServer
          .from('document_content')
          .insert(chunk)

        if (error) {
          console.error('Error inserting document content chunk:', error)
          throw error
        }
      }

      console.log(`✅ Stored ${rowsToInsert.length} document sections for connection ${connectionId}`)

    } catch (error) {
      console.error('Error storing Google Docs data:', error)
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
      'https://www.googleapis.com/auth/documents.readonly',
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
