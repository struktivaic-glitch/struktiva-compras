<template>
  <img
    src="/brand/isotipo.png"
    :style="{
      height: size + 'px',
      width: 'auto',
      filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.9)) drop-shadow(0 0 7px rgba(255,255,255,0.55))',
    }"
    alt="Struktiva"
    class="inline-block select-none"
    draggable="false"
  />
</template>

<script setup>
defineProps({ size: { type: [Number, String], default: 34 } });
</script>
