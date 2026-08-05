import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { registerSW } from 'virtual:pwa-register';
import App from './App.vue';
import router from './router/index.js';
import './style.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');

// Detecta despliegues nuevos y se actualiza solo, sin que nadie tenga que borrar caché a mano.
// registerType 'autoUpdate' ya activa el service worker nuevo de inmediato (skipWaiting +
// clientsClaim); lo único que falta es avisarle al navegador que revise seguido (una SPA casi
// nunca hace una navegación completa, que es cuando el navegador revisaría por su cuenta) y
// recargar la página cuando ya haya una versión nueva lista.
const actualizarSW = registerSW({
  onRegisteredSW(swUrl, registration) {
    if (!registration) return;
    registration.update();
    setInterval(() => registration.update(), 60_000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update();
    });
  },
  onNeedRefresh() {
    actualizarSW(true);
  },
});
