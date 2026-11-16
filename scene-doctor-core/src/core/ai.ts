import { estimateTokens } from './tokens.js'
import type { AiAdapter, AiResult } from './types.js'

const DEFAULT_MAX_PROMPT_TOKENS = 2000
const CHARS_PER_TOKEN = 4

export async function askAdapter(
  adapter: AiAdapter,
  reportText: string,
  question: string,
  maxPromptTokens: number = DEFAULT_MAX_PROMPT_TOKENS,
): Promise<AiResult> {
  const budgetChars = maxPromptTokens * CHARS_PER_TOKEN
  const room = Math.max(0, budgetChars - question.length - 1)
  const prompt = `${question}\n${reportText.slice(0, room)}`
  try {
    const text = await adapter.complete(prompt)
    return { ok: true, text, promptTokens: estimateTokens(prompt) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
