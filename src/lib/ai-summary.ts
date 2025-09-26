import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// OpenAI Configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Google Gemini Configuration
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');

export interface AISummary {
  summary: string;
  key_points: string[];
  tags: string[];
  agent_definition: {
    question_types: string[];
    use_cases: string[];
    content_type: string;
    key_entities: string[];
    key_topics: string[];
    data_insights: string[];
  };
  word_count: number;
  reading_time_minutes: number;
  model_used: string;
  tokens_used: number;
}

export async function generateAISummary(
  filename: string,
  fileType: string,
  fileContent: string,
  onProgress?: (message: string) => void
): Promise<AISummary> {
  onProgress?.("I'm trying to understand your data...");
  
  try {
    // Try OpenAI first
    onProgress?.("Let me dig deeper and analyze it...");
    return await generateOpenAISummary(filename, fileType, fileContent, onProgress);
  } catch (openaiError) {
    console.warn('OpenAI failed, falling back to Gemini:', openaiError);
    
    try {
      // Fallback to Gemini
      onProgress?.("Let me try a different approach...");
      return await generateGeminiSummary(filename, fileType, fileContent, onProgress);
    } catch (geminiError) {
      console.error('Both AI services failed:', { openaiError, geminiError });
      throw new Error('I had trouble analyzing this file. Please try again.');
    }
  }
}

async function generateOpenAISummary(
  filename: string,
  fileType: string,
  fileContent: string,
  onProgress?: (message: string) => void
): Promise<AISummary> {
  onProgress?.("Looking at the file structure...");
  
  const systemPrompt = `You are an AI assistant that analyzes files to help other AI agents understand what questions they can answer using this file.

Your task is to create a comprehensive summary that will help an AI agent determine:
1. What types of questions this file can answer
2. What use cases this file supports
3. Key entities, topics, and insights in the file
4. How this file should be categorized for agent queries

For the file "${filename}" (${fileType}), analyze the content and provide:

1. A clear summary of what the file contains
2. Key points that highlight important information
3. Relevant tags for categorization
4. An agent definition with:
   - question_types: What kinds of questions can be answered using this file
   - use_cases: What practical applications this file supports
   - content_type: The type of content (e.g., "tabular_data", "text_document", "financial_report")
   - key_entities: Important people, organizations, or concepts mentioned
   - key_topics: Main themes or subjects covered
   - data_insights: What insights or patterns can be derived from this data

Be specific and practical. Focus on how an AI agent would use this information to help users.`;

  const userPrompt = `Please analyze this file content and provide the structured response:

File: ${filename}
Type: ${fileType}
Content:
${fileContent.substring(0, 8000)} ${fileContent.length > 8000 ? '...[truncated]' : ''}

Provide your response as a JSON object with the following structure:
{
  "summary": "Clear summary of file contents",
  "key_points": ["point1", "point2", "point3"],
  "tags": ["tag1", "tag2", "tag3"],
  "agent_definition": {
    "question_types": ["type1", "type2", "type3"],
    "use_cases": ["use1", "use2", "use3"],
    "content_type": "content_type",
    "key_entities": ["entity1", "entity2"],
    "key_topics": ["topic1", "topic2"],
    "data_insights": ["insight1", "insight2"]
  }
}`;

  onProgress?.("Aah, I got the summary. Let me generate it...");
  
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.3'),
    response_format: { type: 'json_object' }
  });

  onProgress?.("I'm ready!");
  
  const response = completion.choices[0]?.message?.content;
  if (!response) {
    throw new Error('No response from OpenAI');
  }

  const parsed = JSON.parse(response);
  
  return {
    summary: parsed.summary,
    key_points: parsed.key_points || [],
    tags: parsed.tags || [],
    agent_definition: parsed.agent_definition || {
      question_types: [],
      use_cases: [],
      content_type: fileType,
      key_entities: [],
      key_topics: [],
      data_insights: []
    },
    word_count: fileContent.split(/\s+/).length,
    reading_time_minutes: Math.ceil(fileContent.split(/\s+/).length / 200),
    model_used: 'openai',
    tokens_used: completion.usage?.total_tokens || 0
  };
}

async function generateGeminiSummary(
  filename: string,
  fileType: string,
  fileContent: string,
  onProgress?: (message: string) => void
): Promise<AISummary> {
  onProgress?.("Looking at the file structure...");
  
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  
  const prompt = `You are an AI assistant that analyzes files to help other AI agents understand what questions they can answer using this file.

For the file "${filename}" (${fileType}), analyze the content and provide a JSON response with:

{
  "summary": "Clear summary of file contents",
  "key_points": ["point1", "point2", "point3"],
  "tags": ["tag1", "tag2", "tag3"],
  "agent_definition": {
    "question_types": ["What types of questions can be answered using this file"],
    "use_cases": ["What practical applications this file supports"],
    "content_type": "The type of content (e.g., tabular_data, text_document, financial_report)",
    "key_entities": ["Important people, organizations, or concepts mentioned"],
    "key_topics": ["Main themes or subjects covered"],
    "data_insights": ["What insights or patterns can be derived from this data"]
  }
}

File content:
${fileContent.substring(0, 8000)} ${fileContent.length > 8000 ? '...[truncated]' : ''}

Be specific and practical. Focus on how an AI agent would use this information to help users.`;

  onProgress?.("Aah, I got the summary. Let me generate it...");
  
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  
  onProgress?.("I'm ready!");
  
  // Extract JSON from response (Gemini sometimes adds extra text)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No valid JSON found in Gemini response');
  }
  
  const parsed = JSON.parse(jsonMatch[0]);
  
  return {
    summary: parsed.summary,
    key_points: parsed.key_points || [],
    tags: parsed.tags || [],
    agent_definition: parsed.agent_definition || {
      question_types: [],
      use_cases: [],
      content_type: fileType,
      key_entities: [],
      key_topics: [],
      data_insights: []
    },
    word_count: fileContent.split(/\s+/).length,
    reading_time_minutes: Math.ceil(fileContent.split(/\s+/).length / 200),
    model_used: 'gemini',
    tokens_used: 0 // Gemini doesn't provide token count in the same way
  };
}
