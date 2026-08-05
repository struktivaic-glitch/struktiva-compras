// Envío de mensajes por Telegram. Todo aquí es "best effort": si Telegram falla o no está
// configurado, nunca debe tronar la acción real del usuario (crear/autorizar/cancelar algo) —
// por eso cada función atrapa sus propios errores y solo los deja en el log.

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

export function telegramConfigurado() {
  return Boolean(BOT_TOKEN);
}

export async function enviarTelegram(chatId, texto) {
  if (!API_BASE || !chatId) return;
  try {
    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: texto }),
    });
    if (!res.ok) {
      console.error('Telegram sendMessage falló:', res.status, await res.text());
    }
  } catch (err) {
    console.error('Telegram sendMessage error:', err.message);
  }
}

export async function obtenerInfoBot() {
  if (!API_BASE) return null;
  const res = await fetch(`${API_BASE}/getMe`);
  const data = await res.json();
  return data.result ?? null;
}
