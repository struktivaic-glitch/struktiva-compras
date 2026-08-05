// Helpers para generar notificaciones internas (campanita). Todo pasa por aquí para que las
// reglas de "quién se entera de qué" vivan en un solo lugar, no repartidas en cada módulo.

export async function notificarUsuario(client, { usuarioId, categoria, entidadTipo, entidadId, titulo, mensaje }) {
  await client.query(
    `INSERT INTO notificaciones (usuario_id, categoria, entidad_tipo, entidad_id, titulo, mensaje)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [usuarioId, categoria, entidadTipo, entidadId, titulo, mensaje ?? null]
  );
}

// Notifica a todos los usuarios activos que tengan alguno de los roles dados.
// excluirUsuarioId es opcional — útil para no avisarle a quien acaba de hacer la acción.
export async function notificarPorRol(client, { roles, categoria, entidadTipo, entidadId, titulo, mensaje, excluirUsuarioId }) {
  const { rows } = await client.query(
    `SELECT u.id FROM usuarios u
     JOIN roles r ON r.id = u.rol_id
     WHERE u.activo AND r.clave = ANY($1::text[]) AND u.id != COALESCE($2, '00000000-0000-0000-0000-000000000000'::uuid)`,
    [roles, excluirUsuarioId ?? null]
  );
  for (const { id } of rows) {
    await notificarUsuario(client, { usuarioId: id, categoria, entidadTipo, entidadId, titulo, mensaje });
  }
}
