import OpenAI from 'openai'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import { RTFParser } from 'rtf-parser'
import * as yauzl from 'yauzl'

// Initialize AI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface TextExtractionResult {
  extractedText: string
  extractionMethod: string
  confidence: number
  isReadable: boolean
  error?: string
  tokensUsed?: number // Track tokens for cost monitoring
}

/**
 * Extract text from files using LLM-based approaches
 * This can handle both text-based and image-based documents
 * 
 * Flow:
 * 1. Directly use LLM to process file and extract text
 * 2. If file is unreadable, return appropriate error for user feedback
 */
export async function extractTextWithLLM(
  filename: string,
  fileType: string,
  fileBuffer: ArrayBuffer,
  onProgress?: (message: string) => void
): Promise<TextExtractionResult> {
  
  onProgress?.("🔍 Analyzing file with AI...")
  console.log(`🔍 File type analysis: ${filename} -> ${fileType}`)
  
  try {
    // STEP 1: Directly use LLM to process the file
    onProgress?.("🤖 Processing file with AI...")
    const llmResult = await processFileWithLLM(filename, fileType, fileBuffer, onProgress)
    
    // STEP 2: Return the result
    if (llmResult.isReadable) {
      onProgress?.("✅ AI processing successful")
      return llmResult
    } else {
      onProgress?.("❌ AI processing failed - file appears unreadable")
      return llmResult
    }
    
  } catch (error) {
    console.error('❌ LLM text extraction failed:', error)
    return {
      extractedText: '',
      extractionMethod: 'llm_failed',
      confidence: 0,
      isReadable: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Process file with LLM: extract text first, then validate with LLM
 */
async function processFileWithLLM(
  filename: string,
  fileType: string,
  fileBuffer: ArrayBuffer,
  onProgress?: (message: string) => void
): Promise<TextExtractionResult> {
  
  try {
    // STEP 1: Extract text using appropriate method for file type
    onProgress?.("📄 Extracting text from document...")
    let extractedText = ''
    let extractionMethod = ''
    
    if (fileType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') || 
        fileType.includes('application/msword')) {
      // Word documents
      console.log(`📄 Using mammoth for Word document: ${filename}`)
      try {
        // Convert ArrayBuffer to Buffer for mammoth
        const buffer = Buffer.from(fileBuffer)
        const result = await mammoth.extractRawText({ buffer })
        extractedText = result.value
        extractionMethod = 'mammoth'
        console.log(`✅ Mammoth extracted ${extractedText.length} characters from ${filename}`)
      } catch (mammothError) {
        console.error(`❌ Mammoth extraction failed for ${filename}:`, mammothError)
        throw new Error(`Failed to extract text from Word document: ${mammothError instanceof Error ? mammothError.message : 'Unknown error'}`)
      }
    } else if (fileType === 'application/pdf') {
      // PDFs - try basic extraction
      console.log(`📄 Using basic PDF extraction for: ${filename}`)
      const pdfResult = await extractBasicPDF(fileBuffer)
      extractedText = pdfResult.extractedText
      extractionMethod = pdfResult.extractionMethod
      
      // If PDF extraction failed, try a more lenient approach
      if (!extractedText || extractedText.length < 10) {
        console.log(`⚠️ PDF extraction failed, trying fallback method`)
        const fallbackText = Buffer.from(fileBuffer).toString('utf-8')
        const cleanText = fallbackText
          .replace(/[^\x20-\x7E\s]/g, ' ') // Remove non-printable characters
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim()
        
        const words = cleanText.split(/\s+/).filter(word => word.length > 2)
        console.log(`🔍 PDF Fallback Analysis: ${words.length} words, ${cleanText.length} characters`)
        console.log(`📄 Fallback sample text: "${cleanText.substring(0, 200)}..."`)
        
        if (words.length > 5) {
          extractedText = cleanText
          extractionMethod = 'pdf_fallback_utf8'
          console.log(`✅ PDF fallback: Extracted ${extractedText.length} characters, ${words.length} words`)
        } else {
          console.log(`❌ PDF fallback: Insufficient readable content (${words.length} words)`)
        }
      }
    } else if (fileType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
               fileType.includes('application/vnd.ms-excel')) {
      // Excel files
      console.log(`📄 Using XLSX library for Excel file: ${filename}`)
      try {
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
        const sheetNames = workbook.SheetNames
        let allText = ''
        
        // Extract text from all sheets
        for (const sheetName of sheetNames) {
          const worksheet = workbook.Sheets[sheetName]
          const sheetText = XLSX.utils.sheet_to_txt(worksheet)
          if (sheetText.trim()) {
            allText += `Sheet: ${sheetName}\n${sheetText}\n\n`
          }
        }
        
        extractedText = allText.trim()
        extractionMethod = 'xlsx'
        console.log(`✅ XLSX extracted ${extractedText.length} characters from ${filename}`)
      } catch (excelError) {
        console.error(`❌ Excel extraction failed for ${filename}:`, excelError)
        throw new Error(`Failed to extract text from Excel file: ${excelError instanceof Error ? excelError.message : 'Unknown error'}`)
      }
    } else if (fileType === 'application/rtf') {
      // RTF files
      console.log(`📄 Using RTF parser for RTF file: ${filename}`)
      try {
        const rtfText = await extractRTFText(fileBuffer)
        extractedText = rtfText
        extractionMethod = 'rtf_parser'
        console.log(`✅ RTF extracted ${extractedText.length} characters from ${filename}`)
      } catch (rtfError) {
        console.error(`❌ RTF extraction failed for ${filename}:`, rtfError)
        throw new Error(`Failed to extract text from RTF file: ${rtfError instanceof Error ? rtfError.message : 'Unknown error'}`)
      }
    } else if (fileType.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation') ||
               fileType.includes('application/vnd.ms-powerpoint')) {
      // PowerPoint files
      console.log(`📄 Using pptx2json for PowerPoint file: ${filename}`)
      try {
        const pptxText = await extractPowerPointText(fileBuffer)
        extractedText = pptxText
        extractionMethod = 'pptx2json'
        console.log(`✅ PowerPoint extracted ${extractedText.length} characters from ${filename}`)
      } catch (pptxError) {
        console.error(`❌ PowerPoint extraction failed for ${filename}:`, pptxError)
        throw new Error(`Failed to extract text from PowerPoint file: ${pptxError instanceof Error ? pptxError.message : 'Unknown error'}`)
      }
    } else if (fileType.startsWith('text/') || fileType === 'application/json' || fileType === 'application/csv') {
      // Text files
      console.log(`📄 Using UTF-8 decoding for text file: ${filename}`)
      extractedText = Buffer.from(fileBuffer).toString('utf-8')
      extractionMethod = 'utf8_decode'
    } else {
      // Other file types
      console.log(`📄 Using generic extraction for: ${filename}`)
      extractedText = Buffer.from(fileBuffer).toString('utf-8')
      extractionMethod = 'generic'
    }
    
        // STEP 2: Pre-validate text before LLM validation
        if (extractedText.trim()) {
          const isPDF = fileType === 'application/pdf'
          
          // For PDFs, do a quick pre-validation to check if there's substantial readable content
          if (isPDF) {
            const words = extractedText.split(/\s+/).filter(word => word.length > 2)
            const readableChars = extractedText.replace(/[^\x20-\x7E\s]/g, '').length
            const totalChars = extractedText.length
            const readableRatio = readableChars / totalChars
            
            console.log(`🔍 PDF Pre-validation: ${words.length} words, ${readableRatio.toFixed(2)} readable ratio`)
            console.log(`📄 Pre-validation sample: "${extractedText.substring(0, 200)}..."`)
            
            // If PDF has substantial readable content, skip strict LLM validation
            // Made more lenient: >5 words and >0.2 ratio
            if (words.length > 5 && readableRatio > 0.2) {
              console.log(`✅ PDF Pre-validation passed: Substantial readable content found`)
              return {
                extractedText: extractedText,
                extractionMethod: `${extractionMethod} + pdf_pre_validated`,
                confidence: 0.8,
                isReadable: true,
                error: undefined,
                tokensUsed: 0
              }
            } else {
              console.log(`⚠️ PDF Pre-validation failed: ${words.length} words (need >5), ${readableRatio.toFixed(2)} ratio (need >0.2)`)
            }
          }
          
          // For non-PDFs or PDFs that didn't pass pre-validation, use LLM validation
          onProgress?.("🤖 Validating text with AI...")
          const validationResult = await validateTextWithLLM(filename, extractedText)
          
          // For PDFs, be more lenient with validation
          const isReadable = isPDF ? 
            (validationResult.isReadable || validationResult.confidence > 0.2) : 
            validationResult.isReadable
          
          return {
            extractedText: validationResult.improvedText || extractedText,
            extractionMethod: `${extractionMethod} + llm_validation`,
            confidence: validationResult.confidence,
            isReadable: isReadable,
            error: isReadable ? undefined : validationResult.error,
            tokensUsed: validationResult.tokensUsed
          }
        } else {
          // No text extracted, return error
          return {
            extractedText: '',
            extractionMethod: extractionMethod,
            confidence: 0,
            isReadable: false,
            error: 'No text could be extracted from this file. The file may be empty, corrupted, or in an unsupported format.',
            tokensUsed: 0
          }
        }
    
  } catch (error) {
    console.error('❌ File processing failed:', error)
    return {
      extractedText: '',
      extractionMethod: 'failed',
      confidence: 0,
      isReadable: false,
      error: `Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      tokensUsed: 0
    }
  }
}

/**
 * Enhanced PDF text extraction with multiple methods
 */
async function extractBasicPDF(fileBuffer: ArrayBuffer): Promise<{extractedText: string, extractionMethod: string}> {
  try {
    const uint8Array = new Uint8Array(fileBuffer)
    const utf8Text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(uint8Array)
    
    console.log(`🔍 PDF Analysis: File size ${fileBuffer.byteLength} bytes, UTF-8 length ${utf8Text.length}`)
    
    // Method 1: Look for text operators (Tj, TJ)
    const textMatches = utf8Text.match(/\(([^)]+)\)\s*Tj/g)
    if (textMatches && textMatches.length > 0) {
      const extractedText = textMatches
        .map(match => match.replace(/\(|\)/g, '').replace(/Tj/g, '').trim())
        .filter(text => text.length > 2)
        .join(' ')
      
      if (extractedText.length > 10) {
        console.log(`✅ PDF Method 1 (Tj operators): Extracted ${extractedText.length} characters`)
        return { extractedText, extractionMethod: 'pdf_text_operators' }
      }
    }
    
    // Method 2: Look for text in brackets with different operators
    const bracketMatches = utf8Text.match(/\[([^\]]+)\]\s*TJ/g)
    if (bracketMatches && bracketMatches.length > 0) {
      const extractedText = bracketMatches
        .map(match => match.replace(/\[|\]/g, '').replace(/TJ/g, '').trim())
        .filter(text => text.length > 2)
        .join(' ')
      
      if (extractedText.length > 10) {
        console.log(`✅ PDF Method 2 (TJ operators): Extracted ${extractedText.length} characters`)
        return { extractedText, extractionMethod: 'pdf_bracket_operators' }
      }
    }
    
    // Method 3: Look for text between BT and ET (text objects)
    const textObjectMatches = utf8Text.match(/BT\s*[\s\S]*?\s*ET/g)
    if (textObjectMatches && textObjectMatches.length > 0) {
      let extractedText = ''
      for (const match of textObjectMatches) {
        const textInObject = match.match(/\(([^)]+)\)/g)
        if (textInObject) {
          extractedText += textInObject
            .map(t => t.replace(/\(|\)/g, '').trim())
            .filter(t => t.length > 1)
            .join(' ') + ' '
        }
      }
      
      if (extractedText.trim().length > 10) {
        console.log(`✅ PDF Method 3 (text objects): Extracted ${extractedText.length} characters`)
        return { extractedText: extractedText.trim(), extractionMethod: 'pdf_text_objects' }
      }
    }
    
    // Method 4: Look for readable text patterns (fallback)
    const readableText = utf8Text
      .replace(/[^\x20-\x7E\s]/g, ' ') // Remove non-printable characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
    
    // Check if we have substantial readable text
    const words = readableText.split(/\s+/).filter(word => word.length > 2)
    if (words.length > 10) {
      console.log(`✅ PDF Method 4 (readable text): Extracted ${readableText.length} characters, ${words.length} words`)
      console.log(`📄 Sample extracted text: "${readableText.substring(0, 200)}..."`)
      return { extractedText: readableText, extractionMethod: 'pdf_readable_text' }
    }
    
    // Method 5: More aggressive text extraction - look for any text patterns
    const aggressiveText = utf8Text
      .replace(/[^\x20-\x7E\s\u00A0-\u00FF]/g, ' ') // Allow extended ASCII
      .replace(/\s+/g, ' ')
      .trim()
    
    const aggressiveWords = aggressiveText.split(/\s+/).filter(word => word.length > 1)
    if (aggressiveWords.length > 15) {
      console.log(`✅ PDF Method 5 (aggressive text): Extracted ${aggressiveText.length} characters, ${aggressiveWords.length} words`)
      console.log(`📄 Aggressive sample: "${aggressiveText.substring(0, 200)}..."`)
      return { extractedText: aggressiveText, extractionMethod: 'pdf_aggressive_text' }
    }
    
    console.log(`❌ PDF: No readable text found using any method`)
    return { extractedText: '', extractionMethod: 'pdf_no_text_found' }
  } catch (error) {
    console.error(`❌ PDF extraction failed:`, error)
    return { extractedText: '', extractionMethod: 'pdf_extraction_failed' }
  }
}

/**
 * RTF text extraction
 */
async function extractRTFText(fileBuffer: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const buffer = Buffer.from(fileBuffer)
      const parser = new RTFParser()
      let extractedText = ''
      
      parser.on('text', (text: string) => {
        extractedText += text
      })
      
      parser.on('end', () => {
        resolve(extractedText.trim())
      })
      
      parser.on('error', (error: Error) => {
        reject(error)
      })
      
      parser.write(buffer)
      parser.end()
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * PowerPoint text extraction using yauzl (server-side compatible)
 */
async function extractPowerPointText(fileBuffer: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const buffer = Buffer.from(fileBuffer)
      let extractedText = ''
      let processedSlides = 0
      
      // PPTX files are ZIP archives, so we can extract them
      yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
        if (err) {
          reject(new Error(`PowerPoint parsing failed: ${err.message}`))
          return
        }
        
        if (!zipfile) {
          reject(new Error('Failed to open PowerPoint file'))
          return
        }
        
        zipfile.readEntry()
        
        zipfile.on('entry', (entry) => {
          // Look for slide XML files
          if (entry.fileName.startsWith('ppt/slides/slide') && entry.fileName.endsWith('.xml')) {
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) {
                console.error(`Error reading slide ${entry.fileName}:`, err)
                zipfile.readEntry()
                return
              }
              
              let slideContent = ''
              readStream.on('data', (chunk) => {
                slideContent += chunk.toString()
              })
              
              readStream.on('end', () => {
                // Extract text from XML using regex (simple approach)
                const textMatches = slideContent.match(/<a:t[^>]*>([^<]*)<\/a:t>/g)
                if (textMatches) {
                  for (const match of textMatches) {
                    const textContent = match.replace(/<[^>]*>/g, '')
                    if (textContent.trim()) {
                      extractedText += textContent + ' '
                    }
                  }
                }
                
                processedSlides++
                zipfile.readEntry()
              })
              
              readStream.on('error', (err) => {
                console.error(`Error reading slide stream:`, err)
                zipfile.readEntry()
              })
            })
          } else {
            zipfile.readEntry()
          }
        })
        
        zipfile.on('end', () => {
          // Clean up the extracted text
          const cleanText = extractedText
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim()
          
          if (cleanText.length > 0) {
            console.log(`✅ PowerPoint extracted ${cleanText.length} characters from ${processedSlides} slides`)
            resolve(cleanText)
          } else {
            reject(new Error('No text content found in PowerPoint file'))
          }
        })
        
        zipfile.on('error', (err) => {
          reject(new Error(`PowerPoint extraction failed: ${err.message}`))
        })
      })
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Validate and improve text extraction using LLM
 */
async function validateTextWithLLM(
  filename: string,
  extractedText: string
): Promise<{
  improvedText: string
  confidence: number
  isReadable: boolean
  error?: string
  tokensUsed?: number
}> {
  
  try {
    // Use the model from environment variables
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
    
    const prompt = `You are an AI assistant tasked with validating and cleaning extracted text from a document.
The user has provided text extracted from a file named "${filename}".
Your goal is to determine if this text is genuinely readable and meaningful, or if it's mostly garbage, binary data, or uninterpretable content.

If the text is readable:
- Return isValid: true
- Provide a brief reason for its validity.
- Provide a cleaned_text version, removing any obvious artifacts, repeated patterns, or non-textual elements that might have slipped through.
- Assign a confidence score (0.0 to 1.0) for the readability.

If the text is NOT readable (e.g., mostly binary, garbled, too short to be meaningful, or clearly from an image-only document):
- Return isValid: false
- Provide a clear, concise reason why it's not valid.
- Set cleaned_text to an empty string.
- Assign a confidence score (0.0 to 1.0) for the assessment.

Consider the following criteria for readability:
- Presence of coherent sentences or phrases (even if mixed with some artifacts).
- ${filename.toLowerCase().endsWith('.pdf') ? 'For PDFs: Allow formatting artifacts and binary characters if there is substantial readable content.' : 'Absence of excessive special characters, control characters, or repeating binary patterns.'}
- Sufficient length to convey information (more than just a few words).
- ${filename.toLowerCase().endsWith('.pdf') ? 'For PDFs: Be lenient with character ratios - focus on whether meaningful content exists.' : 'Low ratio of non-alphanumeric characters (excluding common punctuation).'}

Respond ONLY with a JSON object.

Example of a valid response:
{
  "isValid": true,
  "reason": "The text contains coherent sentences and appears to be a report summary.",
  "cleanedText": "This is the cleaned and validated text content.",
  "confidence": 0.95
}

Example of an invalid response:
{
  "isValid": false,
  "reason": "The text contains too many binary characters and lacks coherent structure, indicating an image-based PDF.",
  "cleanedText": "",
  "confidence": 0.1
}

Here is the extracted text to validate:
---
${extractedText.substring(0, 2000)}${extractedText.length > 2000 ? '...[truncated]' : ''}
---`;

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `Validate the following text from "${filename}":\n${extractedText.substring(0, 1000)}` }
      ],
      temperature: 0.1,
      max_tokens: 500, // Limit output tokens for cost efficiency
      response_format: { type: 'json_object' }
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from LLM for text validation');
    }

    const parsedResponse = JSON.parse(responseContent);
    const tokensUsed = completion.usage?.total_tokens || 0
    
    console.log(`🔢 Text validation tokens used: ${tokensUsed} (model: ${model})`)

    return {
      improvedText: parsedResponse.cleanedText || extractedText,
      confidence: parsedResponse.confidence || 0.5,
      isReadable: parsedResponse.isValid || false,
      error: parsedResponse.isValid ? undefined : parsedResponse.reason,
      tokensUsed
    };
  } catch (llmError) {
    console.error('❌ LLM text validation failed:', llmError);
    return {
      improvedText: extractedText,
      confidence: 0.5,
      isReadable: extractedText.length > 50,
      error: `LLM validation internal error: ${llmError instanceof Error ? llmError.message : 'Unknown error'}`,
      tokensUsed: 0
    };
  }
}