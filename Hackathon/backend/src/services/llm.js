/**
 * Cliente de un LLM compatible con la API de chat de OpenAI.
 * Devuelve `null` si no hay clave: el agente usará entonces el modo de palabras clave.
 */
export function crearClienteLLM({ apiKey, model, baseUrl, timeoutMs }, {
  fetch: fetchImpl = globalThis.fetch
} = {}) {
  if (!apiKey) return null;

  const url = `${baseUrl}/chat/completions`;

  return {
    async completar(messages, tools) {
      const respuesta = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({ model, messages, tools, tool_choice: 'auto' }),
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (!respuesta.ok) {
        const detalle = await respuesta.text().catch(() => '');
        throw new Error(`LLM error: ${respuesta.status} ${detalle.slice(0, 300)}`);
      }

      return respuesta.json();
    }
  };
}
