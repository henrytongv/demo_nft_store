<template>
  <div>
    <header class="page-header">
      <div>
        <h1 class="title">{{ $t('store.title') }}</h1>
        <p class="subtitle">{{ $t('store.subtitle') }}</p>
      </div>
      <NuxtLink class="btn secondary" to="/admin">{{ $t('nav.admin') }}</NuxtLink>
    </header>

    <div v-if="error" class="message error">{{ $t('store.loadError') }}</div>
    <div v-else-if="pending" class="message">{{ $t('store.loading') }}</div>
    <template v-else-if="!collection">
      <div class="panel empty">{{ $t('store.noCollection') }}</div>
      <div class="grid">
        <SpecialNftCard />
      </div>
    </template>

    <template v-else>
      <section class="panel" style="margin-bottom: 18px">
        <h2 style="margin-top: 0; color: var(--gold)">{{ collection.name }}</h2>
        <p class="subtitle" style="margin-bottom: 0">{{ collection.description }}</p>
        <div class="row-between" style="margin-top: 12px">
          <span class="badge">{{ $t('store.token') }}: <strong>{{ collection.tokenId }}</strong></span>
          <a v-if="collection.hashscanUrl" :href="collection.hashscanUrl" target="_blank" rel="noopener" class="btn ghost small">
            {{ $t('store.viewHashscan') }}
          </a>
        </div>
      </section>

      <div class="grid">
        <article v-for="item in collection.items" :key="item.id" class="card">
          <img class="card-image" :src="item.imageUrl" :alt="item.name" loading="lazy" />
          <h3>{{ item.name }}</h3>
          <p class="small-note" style="margin: 0">{{ item.description }}</p>
          <span class="price-badge">{{ $t('store.price') }}: <strong>1 HBAR</strong></span>
          <div class="row-between">
            <span class="badge">{{ $t('store.available') }}: <strong>{{ item.remaining }}</strong></span>
            <span class="badge">{{ $t('store.serial') }}: <strong>{{ item.serialStart }}-{{ item.serialEnd }}</strong></span>
          </div>
          <button class="btn" :disabled="item.remaining <= 0" @click="selected = item">
            {{ item.remaining > 0 ? $t('store.buy') : $t('store.soldOut') }}
          </button>
        </article>
        <SpecialNftCard />
      </div>
    </template>

    <PurchaseModal
      v-if="selected"
      :item="selected"
      @close="selected = null"
      @purchased="refresh"
    />

    <SocialFooter />
  </div>
</template>

<script setup lang="ts">
const { data, pending, error, refresh } = await useFetch('/api/collections')
const collection = computed(() => data.value?.collection || null)
const selected = ref<any>(null)
</script>
