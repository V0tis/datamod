/**
 * Shared types for research API and DB shape. Single place for analysis_groq/analysis_gemini structure
 * so routes and frontend don't duplicate casts. No business logic.
 */

/** research_history.analysis_groq / analysis_gemini: keys are 'logic' | 'creative' | 'fact', value is markdown string. */
export type TabAnalysisRecord = Record<string, string>
