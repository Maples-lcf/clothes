<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <div class="page-container">
    <div class="page-card">
      <div class="page-card-header">
        <h2 class="page-title">{{ title }}</h2>
        <div v-if="$slots.actions" class="page-actions">
          <slot name="actions" />
        </div>
      </div>

      <div v-if="$slots.filters" class="page-filters">
        <slot name="filters" />
      </div>

      <div class="page-body">
        <slot />
      </div>
    </div>
  </div>
</template>
