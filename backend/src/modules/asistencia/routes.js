import { pool } from '../../db/pool.js';
import { registrarBitacora } from '../../lib/audit.js';

// Asistencia / checador — entrada, salida y comida diaria del Personal (catálogo `trabajadores`).
// Diseñado para apoyar el registro electrónico de jornada que exige la LFT (Art. 132 Fracc.
// XXXIV): las marcas originales son inalterables — nunca se sobrescriben — y cualquier
// corrección posterior queda registrada aparte, con motivo obligatorio (ver
// `asistencia_correcciones`, migración 017). El cálculo de horas extra es una sugerencia
// configurable (ver `configuracionJornada/routes.js`), no un dictamen legal.

const ROLES_GESTION = ['residente', 'superintendente', 'direccion'];
const CAMPOS_CORREGIBLES = ['hora_entrada', 'hora_salida', 'hora_inicio_comida', 'hora_fin_comida'];
const CAMPOS_FOTO = ['entrada', 'salida', 'inicio_comida', 'fin_comida'];
const MIME_FOTO_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp']);
const FOTO_MAX_BYTES = 4 * 1024 * 1024;

// Columnas a devolver en INSERT/UPDATE de asistencias — nunca "RETURNING *": la tabla ahora
// tiene columnas bytea (foto_*) que no deben viajar en cada respuesta de marcar/corregir.
const COLUMNAS_RETORNO = `id, trabajador_id, fecha, hora_entrada, hora_salida, hora_inicio_comida, hora_fin_comida,
  hora_entrada_original, hora_salida_original, hora_inicio_comida_original, hora_fin_comida_original,
  obra_id, corregido, gps_lat_entrada, gps_lng_entrada, gps_lat_salida, gps_lng_salida,
  registrado_por, notas, creado_en, actualizado_en,
  (foto_entrada IS NOT NULL) AS tiene_foto_entrada, (foto_salida IS NOT NULL) AS tiene_foto_salida,
  (foto_inicio_comida IS NOT NULL) AS tiene_foto_inicio_comida, (foto_fin_comida IS NOT NULL) AS tiene_foto_fin_comida`;

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export default async function asistenciaRoutes(app) {
  app.addHook('preHandler', app.authenticate);

  // Vista de checador: todo el personal activo (filtrable por obra) con su jornada del día.
  app.get('/api/asistencias/checador', async (request) => {
    const dia = request.query.fecha || hoy();
    const obraId = request.query.obraId || null;
    const { rows } = await pool.query(
      `SELECT t.id AS trabajador_id, t.nombre, t.tipo, t.oficio, t.puesto, t.obra_id,
              a.id AS asistencia_id, a.hora_entrada, a.hora_salida, a.hora_inicio_comida, a.hora_fin_comida, a.corregido,
              (a.foto_entrada IS NOT NULL) AS tiene_foto_entrada, (a.foto_salida IS NOT NULL) AS tiene_foto_salida,
              (a.foto_inicio_comida IS NOT NULL) AS tiene_foto_inicio_comida, (a.foto_fin_comida IS NOT NULL) AS tiene_foto_fin_comida
       FROM trabajadores t
       LEFT JOIN asistencias a ON a.trabajador_id = t.id AND a.fecha = $1
       WHERE t.activo ${obraId ? 'AND t.obra_id = $2' : ''}
       ORDER BY t.nombre`,
      obraId ? [dia, obraId] : [dia]
    );
    return { fecha: dia, personal: rows };
  });

  // Histórico/reporte, filtrable por rango de fechas, obra o persona.
  app.get('/api/asistencias', async (request) => {
    const { desde, hasta, obraId, trabajadorId } = request.query;
    const condiciones = [];
    const valores = [];
    if (desde) { valores.push(desde); condiciones.push(`a.fecha >= $${valores.length}`); }
    if (hasta) { valores.push(hasta); condiciones.push(`a.fecha <= $${valores.length}`); }
    if (obraId) { valores.push(obraId); condiciones.push(`a.obra_id = $${valores.length}`); }
    if (trabajadorId) { valores.push(trabajadorId); condiciones.push(`a.trabajador_id = $${valores.length}`); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT a.id, a.trabajador_id, a.fecha, a.hora_entrada, a.hora_salida, a.hora_inicio_comida, a.hora_fin_comida,
              a.hora_entrada_original, a.hora_salida_original, a.hora_inicio_comida_original, a.hora_fin_comida_original,
              a.obra_id, a.corregido, a.gps_lat_entrada, a.gps_lng_entrada, a.gps_lat_salida, a.gps_lng_salida,
              a.registrado_por, a.notas, a.creado_en, a.actualizado_en,
              (a.foto_entrada IS NOT NULL) AS tiene_foto_entrada, (a.foto_salida IS NOT NULL) AS tiene_foto_salida,
              (a.foto_inicio_comida IS NOT NULL) AS tiene_foto_inicio_comida, (a.foto_fin_comida IS NOT NULL) AS tiene_foto_fin_comida,
              t.nombre, t.tipo, t.oficio, t.puesto, o.nombre AS obra_nombre
       FROM asistencias a
       JOIN trabajadores t ON t.id = a.trabajador_id
       LEFT JOIN obras o ON o.id = a.obra_id
       ${where}
       ORDER BY a.fecha DESC, t.nombre
       LIMIT 500`,
      valores
    );
    return rows;
  });

  app.get('/api/asistencias/:id/correcciones', async (request) => {
    const { rows } = await pool.query(
      `SELECT c.*, u.nombre AS corregido_por_nombre FROM asistencia_correcciones c
       JOIN usuarios u ON u.id = c.corregido_por
       WHERE c.asistencia_id = $1 ORDER BY c.corregido_en DESC`,
      [request.params.id]
    );
    return rows;
  });

  app.post('/api/asistencias/entrada', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { trabajadorId, fecha, obraId, gpsLat, gpsLng } = request.body ?? {};
    if (!trabajadorId) return reply.code(400).send({ error: 'trabajadorId es obligatorio' });
    const dia = fecha || hoy();

    const { rows: existentes } = await pool.query(
      'SELECT id, hora_entrada FROM asistencias WHERE trabajador_id = $1 AND fecha = $2',
      [trabajadorId, dia]
    );
    if (existentes[0]?.hora_entrada) {
      return reply.code(409).send({ error: 'Ya tiene entrada registrada ese día' });
    }

    let row;
    if (existentes[0]) {
      const { rows } = await pool.query(
        `UPDATE asistencias SET hora_entrada = now(), hora_entrada_original = now(), obra_id = COALESCE($2, obra_id),
           gps_lat_entrada = $3, gps_lng_entrada = $4, registrado_por = $5, actualizado_en = now()
         WHERE id = $1 RETURNING ${COLUMNAS_RETORNO}`,
        [existentes[0].id, obraId || null, gpsLat ?? null, gpsLng ?? null, request.user.sub]
      );
      row = rows[0];
    } else {
      const { rows } = await pool.query(
        `INSERT INTO asistencias (trabajador_id, fecha, hora_entrada, hora_entrada_original, obra_id, gps_lat_entrada, gps_lng_entrada, registrado_por)
         VALUES ($1, $2, now(), now(), $3, $4, $5, $6) RETURNING ${COLUMNAS_RETORNO}`,
        [trabajadorId, dia, obraId || null, gpsLat ?? null, gpsLng ?? null, request.user.sub]
      );
      row = rows[0];
    }
    await registrarBitacora(pool, {
      tabla: 'asistencias', registroId: row.id, usuarioId: request.user.sub, accion: 'marcar_entrada',
      despues: { trabajadorId, dia },
    });
    return reply.code(201).send(row);
  });

  app.post('/api/asistencias/salida', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { trabajadorId, fecha, gpsLat, gpsLng } = request.body ?? {};
    if (!trabajadorId) return reply.code(400).send({ error: 'trabajadorId es obligatorio' });
    const dia = fecha || hoy();

    const { rows: existentes } = await pool.query(
      'SELECT id, hora_entrada, hora_salida FROM asistencias WHERE trabajador_id = $1 AND fecha = $2',
      [trabajadorId, dia]
    );
    if (!existentes[0]?.hora_entrada) {
      return reply.code(422).send({ error: 'No tiene entrada registrada ese día' });
    }
    if (existentes[0].hora_salida) {
      return reply.code(409).send({ error: 'Ya tiene salida registrada ese día' });
    }

    const { rows } = await pool.query(
      `UPDATE asistencias SET hora_salida = now(), hora_salida_original = now(), gps_lat_salida = $2, gps_lng_salida = $3, actualizado_en = now()
       WHERE id = $1 RETURNING ${COLUMNAS_RETORNO}`,
      [existentes[0].id, gpsLat ?? null, gpsLng ?? null]
    );
    await registrarBitacora(pool, {
      tabla: 'asistencias', registroId: rows[0].id, usuarioId: request.user.sub, accion: 'marcar_salida',
      despues: { trabajadorId, dia },
    });
    return rows[0];
  });

  app.post('/api/asistencias/comida-inicio', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { trabajadorId, fecha } = request.body ?? {};
    if (!trabajadorId) return reply.code(400).send({ error: 'trabajadorId es obligatorio' });
    const dia = fecha || hoy();

    const { rows: existentes } = await pool.query(
      'SELECT id, hora_entrada, hora_inicio_comida FROM asistencias WHERE trabajador_id = $1 AND fecha = $2',
      [trabajadorId, dia]
    );
    if (!existentes[0]?.hora_entrada) return reply.code(422).send({ error: 'No tiene entrada registrada ese día' });
    if (existentes[0].hora_inicio_comida) return reply.code(409).send({ error: 'Ya tiene inicio de comida registrado ese día' });

    const { rows } = await pool.query(
      `UPDATE asistencias SET hora_inicio_comida = now(), hora_inicio_comida_original = now(), actualizado_en = now()
       WHERE id = $1 RETURNING ${COLUMNAS_RETORNO}`,
      [existentes[0].id]
    );
    return reply.code(201).send(rows[0]);
  });

  app.post('/api/asistencias/comida-fin', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { trabajadorId, fecha } = request.body ?? {};
    if (!trabajadorId) return reply.code(400).send({ error: 'trabajadorId es obligatorio' });
    const dia = fecha || hoy();

    const { rows: existentes } = await pool.query(
      'SELECT id, hora_inicio_comida, hora_fin_comida FROM asistencias WHERE trabajador_id = $1 AND fecha = $2',
      [trabajadorId, dia]
    );
    if (!existentes[0]?.hora_inicio_comida) return reply.code(422).send({ error: 'No tiene inicio de comida registrado ese día' });
    if (existentes[0].hora_fin_comida) return reply.code(409).send({ error: 'Ya tiene fin de comida registrado ese día' });

    const { rows } = await pool.query(
      `UPDATE asistencias SET hora_fin_comida = now(), hora_fin_comida_original = now(), actualizado_en = now()
       WHERE id = $1 RETURNING ${COLUMNAS_RETORNO}`,
      [existentes[0].id]
    );
    return reply.code(201).send(rows[0]);
  });

  // Corrección manual — a diferencia de las marcas originales (inalterables), esto exige un
  // motivo y queda registrado como un evento aparte en `asistencia_correcciones`, nunca pisa el
  // valor "_original" correspondiente.
  app.post('/api/asistencias/:id/corregir', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { id } = request.params;
    const { campo, valorNuevo, motivo } = request.body ?? {};
    if (!CAMPOS_CORREGIBLES.includes(campo)) return reply.code(400).send({ error: 'Campo a corregir inválido' });
    if (!valorNuevo) return reply.code(400).send({ error: 'El nuevo valor es obligatorio' });
    if (!motivo?.trim() || motivo.trim().length < 5) {
      return reply.code(400).send({ error: 'El motivo de la corrección es obligatorio (mínimo 5 caracteres) — se guarda como evidencia.' });
    }

    const { rows: existentes } = await pool.query(`SELECT id, ${campo} AS valor_actual FROM asistencias WHERE id = $1`, [id]);
    if (!existentes[0]) return reply.code(404).send({ error: 'Registro de asistencia no encontrado' });

    const { rows } = await pool.query(
      `UPDATE asistencias SET ${campo} = $2, corregido = true, actualizado_en = now() WHERE id = $1 RETURNING ${COLUMNAS_RETORNO}`,
      [id, valorNuevo]
    );
    await pool.query(
      `INSERT INTO asistencia_correcciones (asistencia_id, campo, valor_anterior, valor_nuevo, motivo, corregido_por)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, campo, existentes[0].valor_actual, valorNuevo, motivo.trim(), request.user.sub]
    );
    await registrarBitacora(pool, {
      tabla: 'asistencias', registroId: id, usuarioId: request.user.sub, accion: 'corregir',
      antes: { [campo]: existentes[0].valor_actual }, despues: { [campo]: valorNuevo, motivo: motivo.trim() },
    });
    return rows[0];
  });

  // Sugerencia de horas ordinarias/dobles/triples por semana, según la configuración vigente de
  // jornada (ver configuracionJornada/routes.js). Es un apoyo de cálculo, no un dictamen legal —
  // recomendable validar el criterio con asesoría laboral antes de usarlo para nómina real.
  app.get('/api/asistencias/horas-extra', async (request) => {
    const { desde, hasta, trabajadorId } = request.query;
    if (!desde || !hasta) return { error: 'desde y hasta son obligatorios' };

    const condiciones = ['a.fecha BETWEEN $1 AND $2', 'a.hora_entrada IS NOT NULL', 'a.hora_salida IS NOT NULL'];
    const valores = [desde, hasta];
    if (trabajadorId) { valores.push(trabajadorId); condiciones.push(`a.trabajador_id = $${valores.length}`); }

    const { rows: registros } = await pool.query(
      `SELECT a.trabajador_id, t.nombre AS trabajador_nombre, a.fecha, a.hora_entrada, a.hora_salida,
              a.hora_inicio_comida, a.hora_fin_comida
       FROM asistencias a JOIN trabajadores t ON t.id = a.trabajador_id
       WHERE ${condiciones.join(' AND ')}
       ORDER BY a.trabajador_id, a.fecha`,
      valores
    );
    const { rows: config } = await pool.query('SELECT * FROM configuracion_jornada ORDER BY vigente_desde');

    function configVigente(fecha) {
      // pg regresa columnas DATE como objetos Date de JS — comparar un Date contra un string con
      // <= usa Date.prototype.toString() (no ISO), lo que rompía silenciosamente esta comparación.
      // Se normalizan ambos lados a 'YYYY-MM-DD' antes de comparar.
      const buscada = fecha.toISOString().slice(0, 10);
      const aplicables = config.filter((c) => new Date(c.vigente_desde).toISOString().slice(0, 10) <= buscada);
      return aplicables[aplicables.length - 1] ?? null;
    }
    function inicioSemana(fecha) {
      const d = new Date(fecha);
      const diaSemana = (d.getUTCDay() + 6) % 7; // lunes=0 ... domingo=6
      d.setUTCDate(d.getUTCDate() - diaSemana);
      return d.toISOString().slice(0, 10);
    }

    const porSemana = new Map(); // clave: trabajadorId|semanaInicio
    for (const r of registros) {
      const horasComida = r.hora_inicio_comida && r.hora_fin_comida
        ? (new Date(r.hora_fin_comida) - new Date(r.hora_inicio_comida)) / 3_600_000
        : 0;
      const horasDia = Math.max(0, (new Date(r.hora_salida) - new Date(r.hora_entrada)) / 3_600_000 - horasComida);
      const semanaInicio = inicioSemana(r.fecha);
      const clave = `${r.trabajador_id}|${semanaInicio}`;
      if (!porSemana.has(clave)) {
        porSemana.set(clave, { trabajadorId: r.trabajador_id, trabajadorNombre: r.trabajador_nombre, semanaInicio, horasTrabajadas: 0 });
      }
      porSemana.get(clave).horasTrabajadas += horasDia;
    }

    return Array.from(porSemana.values()).map((s) => {
      const cfg = configVigente(new Date(s.semanaInicio));
      const jornada = cfg ? Number(cfg.jornada_semanal_horas) : null;
      const topeDobles = cfg ? Number(cfg.limite_semanal_dobles_horas) : null;
      const horasTrabajadas = Number(s.horasTrabajadas.toFixed(2));
      const horasOrdinarias = jornada != null ? Math.min(horasTrabajadas, jornada) : horasTrabajadas;
      const horasExtraTotales = jornada != null ? Math.max(0, horasTrabajadas - jornada) : 0;
      const horasDobles = topeDobles != null ? Math.min(horasExtraTotales, topeDobles) : horasExtraTotales;
      const horasTriples = topeDobles != null ? Math.max(0, horasExtraTotales - topeDobles) : 0;
      return {
        ...s,
        horasTrabajadas,
        jornadaVigente: jornada,
        topeDoblesVigente: topeDobles,
        horasOrdinarias: Number(horasOrdinarias.toFixed(2)),
        horasDobles: Number(horasDobles.toFixed(2)),
        horasTriples: Number(horasTriples.toFixed(2)),
      };
    }).sort((a, b) => a.trabajadorNombre.localeCompare(b.trabajadorNombre) || a.semanaInicio.localeCompare(b.semanaInicio));
  });

  // Selfie opcional por marca (entrada/salida/inicio_comida/fin_comida) — evidencia fotográfica
  // de que la marca corresponde a la persona real, ya que quien marca es el supervisor a nombre
  // del trabajador. Best-effort: nunca bloquea la marca del horario, se sube aparte y después.
  app.post('/api/asistencias/:id/foto/:campo', { preHandler: app.requireRole(...ROLES_GESTION) }, async (request, reply) => {
    const { id, campo } = request.params;
    if (!CAMPOS_FOTO.includes(campo)) return reply.code(400).send({ error: 'Campo de foto inválido' });

    const { rows: existe } = await pool.query('SELECT id FROM asistencias WHERE id = $1', [id]);
    if (!existe[0]) return reply.code(404).send({ error: 'Registro de asistencia no encontrado' });

    const archivo = await request.file();
    if (!archivo) return reply.code(400).send({ error: 'No se recibió ninguna imagen' });
    if (!MIME_FOTO_PERMITIDOS.has(archivo.mimetype)) {
      return reply.code(400).send({ error: 'Formato de imagen no soportado. Usa JPG, PNG o WEBP.' });
    }
    const buffer = await archivo.toBuffer();
    if (buffer.length > FOTO_MAX_BYTES) return reply.code(400).send({ error: 'La imagen es demasiado grande.' });

    await pool.query(
      `UPDATE asistencias SET foto_${campo} = $2, foto_${campo}_mime = $3 WHERE id = $1`,
      [id, buffer, archivo.mimetype]
    );
    await registrarBitacora(pool, {
      tabla: 'asistencias', registroId: id, usuarioId: request.user.sub, accion: `foto_${campo}`,
    });
    return { ok: true };
  });

  app.get('/api/asistencias/:id/foto/:campo', async (request, reply) => {
    const { id, campo } = request.params;
    if (!CAMPOS_FOTO.includes(campo)) return reply.code(400).send({ error: 'Campo de foto inválido' });

    const { rows } = await pool.query(
      `SELECT foto_${campo} AS foto, foto_${campo}_mime AS mime FROM asistencias WHERE id = $1`,
      [id]
    );
    if (!rows[0]?.foto) return reply.code(404).send({ error: 'Esta marca no tiene foto' });
    reply.header('Cache-Control', 'private, max-age=300');
    return reply.type(rows[0].mime || 'image/jpeg').send(rows[0].foto);
  });
}
