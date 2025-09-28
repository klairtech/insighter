import { JSDOM } from 'jsdom'
import { supabaseServer } from '@/lib/server-utils'
import { encryptObject, decryptObject } from '@/lib/encryption'

export interface WebScrapingConfig {
  url: string
  selectors?: {
    title?: string
    content?: string
    exclude?: string[]
    include?: string[]
  }
  maxContentLength?: number
  includeImages?: boolean
  includeLinks?: boolean
  respectRobotsTxt?: boolean
  userAgent?: string
  timeout?: number
}

export interface WebScrapedData {
  url: string
  title: string
  content: string
  metadata: {
    scrapedAt: string
    contentLength: number
    wordCount: number
    language: string
    hasImages: boolean
    hasLinks: boolean
    linkCount: number
    imageCount: number
  }
  structuredData?: {
    headings: Array<{ level: number; text: string; id?: string }>
    tables: Array<{ headers: string[]; rows: string[][] }>
    lists: Array<{ type: 'ordered' | 'unordered'; items: string[] }>
    links: Array<{ text: string; url: string; internal: boolean }>
    images: Array<{ alt: string; src: string; title?: string }>
  }
}

export interface WebScrapedSchema {
  tables: Array<{
    name: string
    type: 'web-content'
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

export class WebScraperConnector {
  private config: WebScrapingConfig

  constructor(config: WebScrapingConfig) {
    this.config = {
      maxContentLength: 50000,
      includeImages: false,
      includeLinks: true,
      respectRobotsTxt: true,
      userAgent: 'InsighterBot/1.0 (+https://insighter.ai/bot)',
      timeout: 30000,
      ...config
    }
  }

  /**
   * Scrape content from a web URL
   */
  async scrapeUrl(): Promise<WebScrapedData> {
    try {
      console.log(`🌐 Scraping URL: ${this.config.url}`)

      // Check robots.txt if enabled
      if (this.config.respectRobotsTxt) {
        const canScrape = await this.checkRobotsTxt()
        if (!canScrape) {
          throw new Error('Robots.txt disallows scraping this URL')
        }
      }

      // Fetch the webpage
      const response = await this.fetchWebPage()
      const html = await response.text()

      // Parse HTML content
      const dom = new JSDOM(html, { url: this.config.url })
      const document = dom.window.document

      // Extract content
      const title = this.extractTitle(document)
      const content = this.extractContent(document)
      const structuredData = this.extractStructuredData(document)

      // Calculate metadata
      const wordCount = content.split(/\s+/).length
      const language = this.detectLanguage(document)

      return {
        url: this.config.url,
        title,
        content: content.substring(0, this.config.maxContentLength || 50000),
        metadata: {
          scrapedAt: new Date().toISOString(),
          contentLength: content.length,
          wordCount,
          language,
          hasImages: (structuredData?.images?.length || 0) > 0,
          hasLinks: (structuredData?.links?.length || 0) > 0,
          linkCount: structuredData?.links?.length || 0,
          imageCount: structuredData?.images?.length || 0
        },
        structuredData
      }

    } catch (error) {
      console.error('Error scraping URL:', error)
      throw new Error(`Failed to scrape URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Fetch webpage with proper headers and timeout
   */
  private async fetchWebPage(): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const response = await fetch(this.config.url, {
        headers: {
          'User-Agent': this.config.userAgent || 'InsighterBot/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return response

    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  /**
   * Check robots.txt to see if scraping is allowed
   */
  private async checkRobotsTxt(): Promise<boolean> {
    try {
      const url = new URL(this.config.url)
      const robotsUrl = `${url.protocol}//${url.host}/robots.txt`
      
      const response = await fetch(robotsUrl, {
        headers: { 'User-Agent': this.config.userAgent || 'InsighterBot/1.0' }
      })

      if (!response.ok) {
        // If robots.txt doesn't exist, assume scraping is allowed
        return true
      }

      const robotsText = await response.text()
      const userAgent = this.config.userAgent || 'InsighterBot'
      
      // Simple robots.txt parsing
      const lines = robotsText.split('\n')
      let currentUserAgent = ''
      let isAllowed = true

      for (const line of lines) {
        const trimmedLine = line.trim().toLowerCase()
        
        if (trimmedLine.startsWith('user-agent:')) {
          const agent = trimmedLine.substring(11).trim()
          currentUserAgent = agent === '*' ? userAgent : agent
        } else if (trimmedLine.startsWith('disallow:') && currentUserAgent === userAgent) {
          const disallowPath = trimmedLine.substring(9).trim()
          if (disallowPath === '/' || this.config.url.includes(disallowPath)) {
            isAllowed = false
          }
        } else if (trimmedLine.startsWith('allow:') && currentUserAgent === userAgent) {
          const allowPath = trimmedLine.substring(6).trim()
          if (this.config.url.includes(allowPath)) {
            isAllowed = true
          }
        }
      }

      return isAllowed

    } catch (error) {
      console.warn('Error checking robots.txt:', error)
      // If we can't check robots.txt, assume scraping is allowed
      return true
    }
  }

  /**
   * Extract page title
   */
  private extractTitle(document: Document): string {
    const titleElement = document.querySelector('title')
    if (titleElement) {
      return titleElement.textContent?.trim() || 'Untitled'
    }

    // Fallback to h1 if no title
    const h1Element = document.querySelector('h1')
    if (h1Element) {
      return h1Element.textContent?.trim() || 'Untitled'
    }

    return 'Untitled'
  }

  /**
   * Extract main content from the page
   */
  private extractContent(document: Document): string {
    // Remove unwanted elements
    const unwantedSelectors = [
      'script', 'style', 'nav', 'header', 'footer', 'aside',
      '.advertisement', '.ads', '.sidebar', '.menu', '.navigation'
    ]

    unwantedSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector)
      elements.forEach(el => el.remove())
    })

    // Try to find main content area
    const mainSelectors = [
      'main', 'article', '.content', '.main-content', 
      '.post-content', '.entry-content', '#content'
    ]

    let contentElement: Element | null = null
    for (const selector of mainSelectors) {
      contentElement = document.querySelector(selector)
      if (contentElement) break
    }

    // Fallback to body if no main content found
    if (!contentElement) {
      contentElement = document.body
    }

    if (!contentElement) {
      return ''
    }

    // Extract text content
    return contentElement.textContent?.trim() || ''
  }

  /**
   * Extract structured data from the page
   */
  private extractStructuredData(document: Document): WebScrapedData['structuredData'] {
    const headings: Array<{ level: number; text: string; id?: string }> = []
    const tables: Array<{ headers: string[]; rows: string[][] }> = []
    const lists: Array<{ type: 'ordered' | 'unordered'; items: string[] }> = []
    const links: Array<{ text: string; url: string; internal: boolean }> = []
    const images: Array<{ alt: string; src: string; title?: string }> = []

    // Extract headings
    for (let i = 1; i <= 6; i++) {
      const headingElements = document.querySelectorAll(`h${i}`)
      headingElements.forEach(heading => {
        headings.push({
          level: i,
          text: heading.textContent?.trim() || '',
          id: heading.id || undefined
        })
      })
    }

    // Extract tables
    const tableElements = document.querySelectorAll('table')
    tableElements.forEach(table => {
      const headers: string[] = []
      const rows: string[][] = []

      // Get headers
      const headerCells = table.querySelectorAll('th')
      if (headerCells.length > 0) {
        headerCells.forEach(cell => {
          headers.push(cell.textContent?.trim() || '')
        })
      }

      // Get rows
      const rowElements = table.querySelectorAll('tr')
      rowElements.forEach(row => {
        const cells = row.querySelectorAll('td, th')
        if (cells.length > 0) {
          const rowData = Array.from(cells).map(cell => 
            cell.textContent?.trim() || ''
          )
          rows.push(rowData)
        }
      })

      if (headers.length > 0 || rows.length > 0) {
        tables.push({ headers, rows })
      }
    })

    // Extract lists
    const listElements = document.querySelectorAll('ul, ol')
    listElements.forEach(list => {
      const items = Array.from(list.querySelectorAll('li')).map(li => 
        li.textContent?.trim() || ''
      )
      
      if (items.length > 0) {
        lists.push({
          type: list.tagName.toLowerCase() === 'ol' ? 'ordered' : 'unordered',
          items
        })
      }
    })

    // Extract links
    if (this.config.includeLinks) {
      const linkElements = document.querySelectorAll('a[href]')
      linkElements.forEach(link => {
        const href = link.getAttribute('href')
        const text = link.textContent?.trim()
        
        if (href && text) {
          const isInternal = href.startsWith('/') || href.includes(new URL(this.config.url).hostname)
          links.push({
            text,
            url: href,
            internal: isInternal
          })
        }
      })
    }

    // Extract images
    if (this.config.includeImages) {
      const imageElements = document.querySelectorAll('img[src]')
      imageElements.forEach(img => {
        const src = img.getAttribute('src')
        const alt = img.getAttribute('alt') || ''
        const title = img.getAttribute('title') || undefined
        
        if (src) {
          images.push({ alt, src, title })
        }
      })
    }

    return {
      headings,
      tables,
      lists,
      links,
      images
    }
  }

  /**
   * Detect page language
   */
  private detectLanguage(document: Document): string {
    // Check html lang attribute
    const htmlLang = document.documentElement.getAttribute('lang')
    if (htmlLang) {
      return htmlLang.substring(0, 2)
    }

    // Check meta language
    const metaLang = document.querySelector('meta[http-equiv="content-language"]')
    if (metaLang) {
      const content = metaLang.getAttribute('content')
      if (content) {
        return content.substring(0, 2)
      }
    }

    // Default to English
    return 'en'
  }

  /**
   * Generate schema from scraped data
   */
  generateSchema(data: WebScrapedData): WebScrapedSchema {
    const columns = [
      {
        name: 'title',
        type: 'text',
        nullable: false,
        sample_values: [data.title],
        ai_definition: undefined
      },
      {
        name: 'content',
        type: 'text',
        nullable: false,
        sample_values: [data.content.substring(0, 200)],
        ai_definition: undefined
      },
      {
        name: 'word_count',
        type: 'number',
        nullable: false,
        sample_values: [data.metadata.wordCount.toString()],
        ai_definition: undefined
      },
      {
        name: 'language',
        type: 'text',
        nullable: false,
        sample_values: [data.metadata.language],
        ai_definition: undefined
      }
    ]

    // Add structured data columns if available
    if (data.structuredData) {
      if (data.structuredData.headings.length > 0) {
        columns.push({
          name: 'headings_count',
          type: 'number',
          nullable: false,
          sample_values: [data.structuredData.headings.length.toString()],
          ai_definition: undefined
        })
      }

      if (data.structuredData.tables.length > 0) {
        columns.push({
          name: 'tables_count',
          type: 'number',
          nullable: false,
          sample_values: [data.structuredData.tables.length.toString()],
          ai_definition: undefined
        })
      }

      if (data.structuredData.links.length > 0) {
        columns.push({
          name: 'links_count',
          type: 'number',
          nullable: false,
          sample_values: [data.structuredData.links.length.toString()],
          ai_definition: undefined
        })
      }
    }

    return {
      tables: [{
        name: 'web_content',
        type: 'web-content',
        columns,
        row_count: 1, // Single row for the scraped page
        ai_definition: undefined
      }],
      ai_definition: undefined
    }
  }

  /**
   * Store scraped data in database
   */
  async storeScrapedData(
    connectionId: string, 
    data: WebScrapedData, 
    schema: WebScrapedSchema
  ): Promise<void> {
    try {
      // Clear existing data for this connection
      await supabaseServer
        .from('web_scraped_content')
        .delete()
        .eq('connection_id', connectionId)

      // Store new data
      const contentHash = await this.generateContentHash(data.content)
      
      const { error } = await supabaseServer
        .from('web_scraped_content')
        .insert({
          connection_id: connectionId,
          url: data.url,
          title: data.title,
          content_encrypted: encryptObject({ content: data.content }),
          content_hash: contentHash,
          content_type: 'html',
          metadata: data.metadata,
          scraped_at: data.metadata.scrapedAt,
          content_size_bytes: data.metadata.contentLength,
          word_count: data.metadata.wordCount,
          language: data.metadata.language
        })

      if (error) {
        console.error('Error inserting scraped content:', error)
        throw error
      }

      console.log(`✅ Stored scraped content for URL: ${data.url}`)

    } catch (error) {
      console.error('Error storing scraped data:', error)
      throw error
    }
  }

  /**
   * Generate content hash for change detection
   */
  private async generateContentHash(content: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(content)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }
}
