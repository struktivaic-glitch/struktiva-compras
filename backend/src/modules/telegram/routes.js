import crypto from 'node:crypto';
import { pool } from '../../db/pool.js';
import { enviarTelegram, obtenerInfoBot, telegramConfigurado } from '../../lib/telegram.js';

export default async function telegramRoutes(app) {
  // Estado + generación de código de vinculación — requiere sesión (usuario ya logueado en la app).
  app.register(async (scoped) => {
    scoped.addHook('preHandler', app.authenticate);

    scoped.get('/api/telegram/estado', async (request) => {
      const { rows } = await pool.query('SELECT telegram_chat_id FROM usuarios WHERE id = $1', [request.user.sub]);
      const info = telegramConfigurado() ? await obtenerInfoBot().catch(() => null) : null;
      return { vinculado: Boolean(rows[0]?.telegram_chat_id), botUsername: info?.username ?? null };
    });

    scoped.post('/api/telegram/vincular', async (request, reply) => {
      if (!telegramConfigurado()) return reply.code(400).send({ error: 'El bot de Telegram aún no está configurado en el servidor.' });
      const codigo = crypto.randomBytes(6).toString('hex');
      await pool.query('UPDATE usuarios SET telegram_link_code = $2 WHERE id = $1', [request.user.sub, codigo]);
      const info = await obtenerInfoBot();
      return { codigo, enlace: info?.username ? `https://t.me/${info.username}?start=${codigo}` : null };
    });

    scoped.post('/api/telegram/desvincular', async (request) => {
      await pool.query('UPDATE usuarios SET telegram_chat_id = NULL WHERE id = $1', [request.user.sub]);
      return { ok: true };
    });
  });

  // Webhook público — lo llama Telegram, no un usuario logueado. Se valida con un secreto propio
  // (no el JWT de la app) que Telegram reenvía en un header, configurado al registrar el webhook.
  app.post('/api/telegram/webhook', async (request, reply) => {
    const secreto = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secreto && request.headers['x-telegram-bot-api-secret-token'] !== secreto) {
      return reply.code(401).send({ error: 'No autorizado' });
    }

    const mensaje = request.body?.message;
    const texto = mensaje?.text ?? '';
    const chatId = mensaje?.chat?.id;
    const match = texto.match(/^\/start\s+([a-f0-9]{12})$/i);

    if (match && chatId) {
      const codigo = match[1];
      const { rows } = await pool.query(
        'UPDATE usuarios SET telegram_chat_id = $2, telegram_link_code = NULL WHERE telegram_link_code = $1 RETURNING nombre',
        [codigo, chatId]
      );
      if (rows[0]) {
        await enviarTelegram(chatId, `✅ Listo, ${rows[0].nombre}. Tu cuenta de Struktiva quedó vinculada — aquí te avisaré cuando tengas algo pendiente.`);
      } else {
        await enviarTelegram(chatId, 'Ese código ya no es válido. Genera uno nuevo desde tu perfil en el sistema.');
      }
    } else if (chatId && texto === '/start') {
      await enviarTelegram(chatId, 'Para vincular tu cuenta, entra a tu perfil dentro del sistema de Struktiva y da clic en "Vincular Telegram".');
    }

    return { ok: true };
  });
}
