<template>
  <article class="card">
    <img class="card-image" src="/hedera_logo.png" alt="Hedera Builder" loading="lazy" />
    <h3>{{ $t('contest.name') }}</h3>
    <p class="small-note" style="margin: 0">{{ $t('contest.description') }}</p>
    <span class="price-badge">{{ $t('store.price') }}: <strong>0 HBAR</strong></span>
    <span class="badge">{{ $t('contest.badge') }}</span>
    <button class="btn" @click="open = true">{{ $t('contest.cta') }}</button>
    <Teleport to="body">
      <ContestModal v-if="open" @close="open = false" />
    </Teleport>
  </article>
</template>

<script setup lang="ts">
const open = ref(false)
</script>
