import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { supabaseServer } from '@/lib/server-utils'
import { encryptObject, decryptObject } from '@/lib/encryption'

interface AIDefinition {
  description?: string
  business_purpose?: string
  key_entities?: string[]
  common_use_cases?: string[]
  data_quality_notes?: string
  [key: string]: unknown
}

interface Column {
  name: string
  type: string
  sample_values: string[]
  ai_definition?: AIDefinition
}

interface Table {
  name: string
  columns: Column[]
  row_count: number
  ai_definition?: AIDefinition
}

interface Schema {
  tables: Table[]
  ai_definition?: AIDefinition
}

export interface GoogleAnalyticsConfig {
  propertyId: string
  startDate?: string
  endDate?: string
  metrics?: string[]
  dimensions?: string[]
  maxResults?: number
  includeRealtime?: boolean
}

export interface GoogleAnalyticsData {
  propertyId: string
  propertyName: string
  reports: Array<{
    reportType: 'standard' | 'realtime'
    data: Array<{
      dimensions: Record<string, string>
      metrics: Record<string, number>
      date?: string
    }>
    metadata: {
      rowCount: number
      totalRows: number
      sampleRate?: number
    }
  }>
  metadata: {
    fetchedAt: string
    dateRange: {
      startDate: string
      endDate: string
    }
    totalReports: number
  }
}

export interface GoogleAnalyticsSchema {
  tables: Array<{
    name: string
    type: 'analytics-report'
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

export class GoogleAnalyticsConnector {
  private oauth2Client: OAuth2Client
  private analytics: ReturnType<typeof google.analytics>
  private analyticsReporting: ReturnType<typeof google.analyticsreporting>

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

    this.analytics = google.analytics({ version: 'v3', auth: this.oauth2Client })
    this.analyticsReporting = google.analyticsreporting({ version: 'v4', auth: this.oauth2Client })
  }

  /**
   * Fetch data from Google Analytics
   */
  async fetchAnalyticsData(config: GoogleAnalyticsConfig): Promise<GoogleAnalyticsData> {
    try {
      console.log(`📊 Fetching Google Analytics data for property: ${config.propertyId}`)

      // Get property information
      const propertyInfo = await this.getPropertyInfo(config.propertyId)
      
      // Fetch standard reports
      const standardReports = await this.fetchStandardReports(config)
      
      // Fetch realtime data if requested
      let realtimeReports: Array<{ metadata: { rowCount: number }; [key: string]: unknown }> = []
      if (config.includeRealtime) {
        realtimeReports = await this.fetchRealtimeData(config)
      }

      const allReports: Array<{
        reportType: 'standard' | 'realtime'
        data: Array<{
          dimensions: Record<string, string>
          metrics: Record<string, number>
          date?: string
        }>
        metadata: {
          rowCount: number
          totalRows: number
          sampleRate?: number
        }
      }> = [...standardReports as any, ...realtimeReports as any]
      const totalRows = allReports.reduce((sum, report) => sum + report.metadata.rowCount, 0)

      return {
        propertyId: config.propertyId,
        propertyName: propertyInfo.name,
        reports: allReports,
        metadata: {
          fetchedAt: new Date().toISOString(),
          dateRange: {
            startDate: config.startDate || this.getDefaultStartDate(),
            endDate: config.endDate || this.getDefaultEndDate()
          },
          totalReports: allReports.length
        }
      }

    } catch (error) {
      console.error('Error fetching Google Analytics data:', error)
      throw new Error(`Failed to fetch Google Analytics data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get property information
   */
  private async getPropertyInfo(propertyId: string): Promise<{ name: string; websiteUrl: string }> {
    try {
      const response = await this.analytics.management.accounts.list()
      
      for (const account of response.data.items || []) {
        const propertiesResponse = await this.analytics.management.webproperties.list({
          accountId: account.id as string
        })
        
        const property = propertiesResponse.data.items?.find((p: any) => p.id === propertyId)
        if (property) {
          return {
            name: property.name || '',
            websiteUrl: property.websiteUrl || ''
          }
        }
      }
      
      throw new Error(`Property ${propertyId} not found`)
    } catch (error) {
      console.warn('Could not fetch property info, using fallback:', error)
      return {
        name: `Property ${propertyId}`,
        websiteUrl: ''
      }
    }
  }

  /**
   * Fetch standard analytics reports
   */
  private async fetchStandardReports(config: GoogleAnalyticsConfig): Promise<Array<{
    reportType: 'standard'
    data: Array<{
      dimensions: Record<string, string>
      metrics: Record<string, number>
      date?: string
    }>
    metadata: {
      rowCount: number
      totalRows: number
      sampleRate?: number
    }
  }>> {
    const reports = []

    // Define common report configurations
    const reportConfigs = [
      {
        name: 'audience_overview',
        title: 'Audience Overview',
        dimensions: ['ga:date', 'ga:country', 'ga:city'],
        metrics: ['ga:sessions', 'ga:users', 'ga:pageviews', 'ga:bounceRate']
      },
      {
        name: 'traffic_sources',
        title: 'Traffic Sources',
        dimensions: ['ga:source', 'ga:medium', 'ga:campaign'],
        metrics: ['ga:sessions', 'ga:users', 'ga:pageviews', 'ga:sessionDuration']
      },
      {
        name: 'content_performance',
        title: 'Content Performance',
        dimensions: ['ga:pagePath', 'ga:pageTitle'],
        metrics: ['ga:pageviews', 'ga:uniquePageviews', 'ga:avgTimeOnPage', 'ga:bounceRate']
      },
      {
        name: 'device_breakdown',
        title: 'Device Breakdown',
        dimensions: ['ga:deviceCategory', 'ga:operatingSystem', 'ga:browser'],
        metrics: ['ga:sessions', 'ga:users', 'ga:pageviews']
      }
    ]

    for (const reportConfig of reportConfigs) {
      try {
        const reportData = await this.fetchReportData(config, reportConfig)
        if (reportData.data.length > 0) {
          reports.push({
            reportType: 'standard',
            ...reportData
          })
        }
      } catch (error) {
        console.warn(`Failed to fetch ${reportConfig.name} report:`, error)
      }
    }

    return reports as any
  }

  /**
   * Fetch individual report data
   */
  private async fetchReportData(config: GoogleAnalyticsConfig, reportConfig: { name: string; dimensions: string[]; metrics: string[]; [key: string]: unknown }): Promise<{
    data: Array<{
      dimensions: Record<string, string>
      metrics: Record<string, number>
      date?: string
    }>
    metadata: {
      rowCount: number
      totalRows: number
      sampleRate?: number
    }
  }> {
    const request = {
      reportRequests: [{
        viewId: config.propertyId,
        dateRanges: [{
          startDate: config.startDate || this.getDefaultStartDate(),
          endDate: config.endDate || this.getDefaultEndDate()
        }],
        dimensions: reportConfig.dimensions.map((dim: string) => ({ name: dim })),
        metrics: reportConfig.metrics.map((met: string) => ({ expression: met })),
        pageSize: config.maxResults || 1000,
        includeEmptyRows: false
      }]
    }

    const response = await this.analyticsReporting.reports.batchGet({ requestBody: request })
    const report = response.data.reports?.[0]

    if (!report || !report.data || !report.data.rows) {
      return {
        data: [],
        metadata: {
          rowCount: 0,
          totalRows: 0
        }
      }
    }

    const data = report!.data.rows.map((row: any) => {
      const dimensions: Record<string, string> = {}
      const metrics: Record<string, number> = {}

      // Map dimensions
      row.dimensions.forEach((value: string, index: number) => {
        const dimensionName = reportConfig.dimensions[index].replace('ga:', '')
        dimensions[dimensionName] = value
      })

      // Map metrics
      (row.metrics[0] as any).values.forEach((value: string, index: number) => {
        const metricName = reportConfig.metrics[index].replace('ga:', '')
        metrics[metricName] = parseFloat(value)
      })

      return {
        dimensions,
        metrics,
        date: dimensions.date || new Date().toISOString().split('T')[0]
      }
    })

    return {
      data,
      metadata: {
        rowCount: data.length,
        totalRows: report!.data.rowCount || data.length,
        sampleRate: report!.data.samplesReadCounts && report!.data.samplesReadCounts.length >= 2 ? 
          (report!.data.samplesReadCounts[0] as unknown as number) / (report!.data.samplesReadCounts[1] as unknown as number) : undefined
      }
    }
  }

  /**
   * Fetch realtime data
   */
  private async fetchRealtimeData(config: GoogleAnalyticsConfig): Promise<Array<{
    reportType: 'realtime'
    data: Array<{
      dimensions: Record<string, string>
      metrics: Record<string, number>
      date?: string
    }>
    metadata: {
      rowCount: number
      totalRows: number
      sampleRate?: number
    }
  }>> {
    try {
      const realtime = google.analytics({ version: 'v3', auth: this.oauth2Client })
      
      const response = await realtime.data.realtime.get({
        ids: `ga:${config.propertyId}`,
        metrics: 'ga:activeUsers,ga:pageviews,ga:screenviews',
        dimensions: 'ga:country,ga:city,ga:deviceCategory'
      })

      const data = response.data.rows?.map((row: string[]) => ({
        dimensions: {
          country: row[0],
          city: row[1],
          deviceCategory: row[2]
        },
        metrics: {
          activeUsers: parseInt(row[3]),
          pageviews: parseInt(row[4]),
          screenviews: parseInt(row[5])
        },
        date: new Date().toISOString()
      })) || []

      return [{
        reportType: 'realtime' as const,
        data,
        metadata: {
          rowCount: data.length,
          totalRows: data.length
        }
      }]

    } catch (error) {
      console.warn('Failed to fetch realtime data:', error)
      return []
    }
  }

  /**
   * Get default start date (30 days ago)
   */
  private getDefaultStartDate(): string {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  }

  /**
   * Get default end date (today)
   */
  private getDefaultEndDate(): string {
    return new Date().toISOString().split('T')[0]
  }

  /**
   * Generate schema from Google Analytics data
   */
  generateSchema(data: GoogleAnalyticsData): GoogleAnalyticsSchema {
    const tables: any[] = data.reports.map((report: any) => {
      // Get all unique dimensions and metrics from the report data
      const allDimensions = new Set<string>()
      const allMetrics = new Set<string>()
      
      report.data.forEach((row: any) => {
        Object.keys(row.dimensions).forEach(dim => allDimensions.add(dim))
        Object.keys(row.metrics).forEach(met => allMetrics.add(met))
      })

      // Create columns for dimensions
      const dimensionColumns = Array.from(allDimensions).map(dimension => {
        const sampleValues = report.data
          .slice(0, 10)
          .map((row: any) => row.dimensions[dimension])
          .filter((value: any) => value !== undefined && value !== null)

        return {
          name: dimension,
          type: 'text',
          nullable: true,
          sample_values: sampleValues,
          ai_definition: undefined
        }
      })

      // Create columns for metrics
      const metricColumns = Array.from(allMetrics).map(metric => {
        const sampleValues = report.data
          .slice(0, 10)
          .map((row: any) => row.metrics[metric]?.toString())
          .filter((value: any) => value !== undefined && value !== null)

        return {
          name: metric,
          type: 'number',
          nullable: true,
          sample_values: sampleValues,
          ai_definition: undefined
        }
      })

      // Add date column if present
      const dateColumn = report.data.some((row: any) => row.date) ? [{
        name: 'date',
        type: 'date',
        nullable: false,
        sample_values: report.data.slice(0, 5).map((row: any) => row.date || ''),
        ai_definition: undefined
      }] : []

      const columns = [...dimensionColumns, ...metricColumns, ...dateColumn]

      return {
        name: `analytics_report_${tables.indexOf(report) + 1}`,
        type: 'analytics-report' as const,
        columns,
        row_count: report.metadata.rowCount,
        ai_definition: undefined
      }
    })

    return {
      tables,
      ai_definition: undefined
    }
  }

  /**
   * Store Google Analytics data in database
   */
  async storeAnalyticsData(
    connectionId: string, 
    data: GoogleAnalyticsData, 
    schema: GoogleAnalyticsSchema
  ): Promise<void> {
    try {
      // Clear existing data for this connection
      await supabaseServer
        .from('analytics_data')
        .delete()
        .eq('connection_id', connectionId)

      // Store new data
      const rowsToInsert = []
      
      for (const report of data.reports) {
        for (const row of report.data) {
          const rowData = {
            connection_id: connectionId,
            report_name: `analytics_report_${data.reports.indexOf(report) + 1}`,
            report_type: report.reportType,
            date: row.date || new Date().toISOString().split('T')[0],
            dimensions_encrypted: encryptObject(row.dimensions),
            metrics_encrypted: encryptObject(row.metrics),
            created_at: new Date().toISOString()
          }
          rowsToInsert.push(rowData)
        }
      }

      // Batch insert
      const chunkSize = 1000
      for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
        const chunk = rowsToInsert.slice(i, i + chunkSize)
        const { error } = await supabaseServer
          .from('analytics_data')
          .insert(chunk)

        if (error) {
          console.error('Error inserting analytics data chunk:', error)
          throw error
        }
      }

      console.log(`✅ Stored ${rowsToInsert.length} analytics records for connection ${connectionId}`)

    } catch (error) {
      console.error('Error storing Google Analytics data:', error)
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
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/analytics'
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
