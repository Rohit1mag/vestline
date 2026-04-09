export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

const MODEL = 'google/gemma-4-31B-it'
const API_URL = 'https://api.together.xyz/v1/chat/completions'

export async function streamChat(
  messages: ChatMessage[],
  onToken: (token: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const apiKey = import.meta.env.VITE_TOGETHER_API_KEY
  if (!apiKey) throw new Error('VITE_TOGETHER_API_KEY is not set in .env')

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
      max_tokens: 1024,
      temperature: 0.6,
      top_p: 0.95,
    }),
    signal,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Together AI error ${res.status}: ${err}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return
      try {
        const json = JSON.parse(data)
        const token: string = json.choices?.[0]?.delta?.content ?? ''
        if (token) onToken(token)
      } catch {
        // malformed SSE line — skip
      }
    }
  }
}
