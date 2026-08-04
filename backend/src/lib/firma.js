import bcrypt from 'bcryptjs';
import { guardarArchivo } from './storage.js';

export async function registrarFirma(client, { request, entidadTipo, entidadId, firma }) {
  if (!firma?.tipo) {
    throw Object.assign(new Error('FIRMA_REQUERIDA'), { code: 400 });
  }

  let imagenUrl = null;

  if (firma.tipo === 'pin') {
    const { rows } = await client.query('SELECT pin_hash FROM usuarios WHERE id = $1', [request.user.sub]);
    const pinHash = rows[0]?.pin_hash;
    if (!pinHash) throw Object.assign(new Error('SIN_PIN_CONFIGURADO'), { code: 400 });
    if (!firma.pin || !bcrypt.compareSync(String(firma.pin), pinHash)) {
      throw Object.assign(new Error('PIN_INCORRECTO'), { code: 422 });
    }
  } else if (firma.tipo === 'tactil') {
    if (!firma.imagenBase64?.startsWith('data:image/')) {
      throw Object.assign(new Error('FIRMA_TACTIL_INVALIDA'), { code: 400 });
    }
    const base64 = firma.imagenBase64.split(',')[1];
    const buffer = Buffer.from(base64, 'base64');
    imagenUrl = await guardarArchivo(buffer, `firma-${entidadTipo}-${entidadId}.png`, 'firmas');
  } else {
    throw Object.assign(new Error('TIPO_FIRMA_INVALIDO'), { code: 400 });
  }

  await client.query(
    `INSERT INTO firmas (entidad_tipo, entidad_id, usuario_id, tipo, imagen_url, ip, user_agent, gps_lat, gps_lng)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      entidadTipo, entidadId, request.user.sub, firma.tipo, imagenUrl,
      request.ip, request.headers['user-agent'] || null,
      firma.gpsLat ?? null, firma.gpsLng ?? null,
    ]
  );
}
