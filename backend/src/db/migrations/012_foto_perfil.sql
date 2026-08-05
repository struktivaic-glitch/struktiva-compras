-- Selfie de perfil por usuario. Se guarda directamente en la base de datos (bytea), no en
-- disco del servidor, porque el disco de Render (plan gratuito) es efímero y se borra en
-- cada deploy — la foto de perfil sí debe persistir siempre. El frontend comprime la imagen
-- a un tamaño chico (~ decenas de KB) antes de subirla, así que este bytea se mantiene ligero.
ALTER TABLE usuarios ADD COLUMN foto_perfil BYTEA;
ALTER TABLE usuarios ADD COLUMN foto_perfil_mime VARCHAR(50);
ALTER TABLE usuarios ADD COLUMN foto_perfil_actualizado TIMESTAMPTZ;
