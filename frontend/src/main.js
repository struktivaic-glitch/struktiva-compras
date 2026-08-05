import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router/index.js';
import './style.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');

// Detecta despliegues nuevos y se actualiza solo, sin que nadie tenga que borrar caché a mano.
// Registro directo con la API nativa del navegador (no el wrapper de vite-plugin-pwa) porque el
// callback onNeedRefresh de la librería no se disparaba de forma confiable con revisiones
// periódicas manuales — este patrón (mandar SKIP_WAITING al worker en espera + recargar en
// cuanto cambia el controlador) es el que el propio sw.js generado ya espera recibir.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then((registration) => {
    const activarSiHayEsperando = () => {
      if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    };

    activarSiHayEsperando();
    registration.addEventListener('updatefound', () => {
      const nuevo = registration.installing;
      if (!nuevo) return;
      nuevo.addEventListener('statechange', () => {
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) activarSiHayEsperando();
      });
    });

    let recargando = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (recargando) return;
      recargando = true;
      location.reload();
    });

    registration.update();
    setInterval(() => registration.update(), 60_000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update();
    });
  });
}
