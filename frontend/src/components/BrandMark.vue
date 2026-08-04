<template>
  <img src="/brand/isotipo.png" :style="{ height: size + 'px', width: 'auto' }" alt="Struktiva" class="inline-block select-none" draggable="false" />
</template>

<script setup>
defineProps({ size: { type: [Number, String], default: 34 } });
</script>
