-- Vinculación de Telegram por usuario, para mandar las notificaciones también por ahí.
-- telegram_link_code: código de un solo uso que el usuario manda al bot (/start <codigo>) para
-- vincular su cuenta; se limpia en cuanto se vincula.

ALTER TABLE usuarios
  ADD COLUMN telegram_chat_id BIGINT,
  ADD COLUMN telegram_link_code VARCHAR(12);

CREATE UNIQUE INDEX idx_usuarios_telegram_link_code ON usuarios (telegram_link_code) WHERE telegram_link_code IS NOT NULL;
