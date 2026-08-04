import { defineStore } from 'pinia';
import { api } from '../lib/api.js';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('struktiva_token') || null,
    usuario: JSON.parse(localStorage.getItem('struktiva_usuario') || 'null'),
  }),
  getters: {
    autenticado: (state) => Boolean(state.token),
    rol: (state) => state.usuario?.rol,
  },
  actions: {
    async login(email, password) {
      const { data } = await api.post('/auth/login', { email, password });
      this.token = data.token;
      this.usuario = data.usuario;
      localStorage.setItem('struktiva_token', data.token);
      localStorage.setItem('struktiva_usuario', JSON.stringify(data.usuario));
    },
    logout() {
      this.token = null;
      this.usuario = null;
      localStorage.removeItem('struktiva_token');
      localStorage.removeItem('struktiva_usuario');
    },
  },
});
