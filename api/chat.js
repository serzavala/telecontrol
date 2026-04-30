export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { messages, context } = req.body
  if (!messages) return res.status(400).json({ error: 'Messages requeridos' })
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: `Eres el asistente de TeleControl, app de control de producción y finanzas para cuadrillas de telecomunicaciones de NOVUS Innovación y Futuro. Responde siempre en español, de forma concisa y profesional. Contexto actual:\n${context || ''}`,
        messages,
      }),
    })
    const data = await response.json()
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Error de API' })
    return res.status(200).json({ content: data.content[0]?.text || '' })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
