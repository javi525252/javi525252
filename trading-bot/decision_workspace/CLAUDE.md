# Espacio de trabajo del motor de decisión

Esta carpeta existe SOLO para ejecutar `claude -p` como motor de decisión de un
bot de trading. Cuando se te invoque aquí:

- Recibirás un JSON con métricas de mercado y el estado de la cuenta.
- Tu única tarea es devolver la decisión (OPEN / CLOSE / HOLD) en el JSON que
  pide el system prompt, **sin texto alrededor y sin vallas de código**.
- NO uses herramientas, NO leas ni escribas archivos, NO ejecutes comandos.
  Limítate a razonar sobre los datos recibidos y responder.
- Ante la duda, responde HOLD. No operar es siempre una opción válida.
