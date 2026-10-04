export const definicion = {
  type: 'function',
  function: {
    name: 'sendPanelLink',
    description:
      'Envía al usuario un botón de WhatsApp con el enlace a su panel web. Úsala cuando pida ver su panel, la web o un enlace.',
    parameters: { type: 'object', properties: {}, required: [] }
  }
};

export const TEXTO_PANEL = 'Abre tu panel aquí (el enlace es personal y de un solo uso):';
export const TEXTO_BOTON_PANEL = 'Abrir mi panel';

export async function ejecutar(_args, { user, servicios, turno }) {
  // Un solo enlace por turno, aunque el modelo llame a la herramienta varias veces.
  if (turno.panelEnviado) return { enviado: true, nota: 'El botón ya se envió en este turno.' };

  const { token } = await servicios.sesiones.crearEnlace(user._id);
  await servicios.mensajeria.enviarBotonUrl(
    user.phone,
    TEXTO_PANEL,
    TEXTO_BOTON_PANEL,
    servicios.sesiones.urlPanel(token)
  );
  turno.panelEnviado = true;
  return { enviado: true };
}
