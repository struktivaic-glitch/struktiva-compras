export async function registrarBitacora(client, { tabla, registroId, usuarioId, accion, antes, despues }) {
  await client.query(
    `INSERT INTO bitacora_auditoria (tabla_afectada, registro_id, usuario_id, accion, valores_anteriores, valores_nuevos)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tabla, String(registroId), usuarioId ?? null, accion, antes ? JSON.stringify(antes) : null, despues ? JSON.stringify(despues) : null]
  );
}
