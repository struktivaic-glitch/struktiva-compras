export async function siguienteFolio(client, prefijo, secuencia) {
  const year = new Date().getFullYear();
  const { rows } = await client.query(`SELECT nextval('${secuencia}') AS n`);
  return `${prefijo}-${year}-${String(rows[0].n).padStart(4, '0')}`;
}
