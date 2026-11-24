<template>
  <div>
    <header class="page-header">
      <div>
        <h1 class="title">{{ $t('admin.title') }}</h1>
        <p class="subtitle">{{ $t('store.subtitle') }}</p>
      </div>
      <div class="row-between">
        <NuxtLink class="btn secondary" to="/">{{ $t('nav.store') }}</NuxtLink>
        <button v-if="authed" class="btn danger" @click="logout">{{ $t('admin.logout') }}</button>
      </div>
    </header>

    <div v-if="checking" class="message">{{ $t('purchase.processing') }}</div>

    <div v-else-if="!authed" class="panel" style="max-width: 520px; margin: 0 auto">
      <h2 style="margin-top:0; color:var(--gold)">{{ $t('admin.loginTitle') }}</h2>
      <form class="stack" @submit.prevent="login">
        <label class="field">
          <span>{{ $t('admin.password') }}</span>
          <input v-model="password" class="input" type="password" autocomplete="current-password" />
        </label>
        <div v-if="loginError" class="message error">{{ loginError }}</div>
        <button class="btn" :disabled="loggingIn">{{ $t('admin.enter') }}</button>
      </form>
    </div>

    <template v-else>
      <div class="tabs">
        <button class="tab" :class="{ active: tab === 'create' }" @click="tab = 'create'">{{ $t('admin.tabs.create') }}</button>
        <button class="tab" :class="{ active: tab === 'active' }" @click="tab = 'active'">{{ $t('admin.tabs.active') }}</button>
        <button class="tab" :class="{ active: tab === 'raffle' }" @click="openRaffle">{{ $t('admin.tabs.raffle') }}</button>
        <button class="tab" :class="{ active: tab === 'contest' }" @click="openContest">{{ $t('admin.tabs.contest') }}</button>
      </div>

      <section v-if="tab === 'create'" class="panel stack">
        <h2 style="margin:0; color:var(--gold)">{{ $t('admin.createTitle') }}</h2>
        <label class="field">
          <span>{{ $t('admin.collectionDescription') }}</span>
          <textarea v-model="createForm.description" class="textarea" />
        </label>
        <p class="small-note">{{ $t('admin.quantityNote') }}</p>

        <div v-for="(item, index) in createItems" :key="item.id" class="panel" style="background: rgba(0,0,0,0.22)">
          <div class="row-between" style="margin-bottom: 12px">
            <strong style="color: var(--gold)">{{ $t('admin.itemName', { n: index + 1 }) }}</strong>
            <button
              v-if="createItems.length > 1"
              type="button"
              class="btn ghost small"
              @click="removeItem(index)"
            >
              {{ $t('admin.removeItem') }}
            </button>
          </div>
          <div class="form-grid">
            <label class="field">
              <span>{{ $t('admin.itemName', { n: index + 1 }) }}</span>
              <input v-model="item.name" class="input" maxlength="80" />
            </label>
            <label class="field">
              <span>{{ $t('admin.itemImage', { n: index + 1 }) }}</span>
              <input class="input" type="file" accept="image/png" @change="onFile(index, $event)" />
            </label>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn secondary" :disabled="createItems.length >= 5" @click="addItem">
            {{ $t('admin.addItem') }}
          </button>
        </div>

        <div v-if="createError" class="message error">{{ createError }}</div>
        <div v-if="createSuccess" class="message success">{{ createSuccess }}</div>
        <div class="form-actions">
          <button class="btn" :disabled="creating" @click="createCollection">
            {{ creating ? $t('admin.creating') : $t('admin.create') }}
          </button>
        </div>
      </section>

      <section v-else-if="tab === 'active'" class="stack">
        <div v-if="!overview?.collection" class="panel empty">{{ $t('admin.empty') }}</div>
        <template v-else>
          <div class="panel">
            <div class="row-between">
              <div>
                <h2 style="margin:0; color:var(--gold)">{{ overview.collection.name }}</h2>
                <p class="subtitle" style="margin:8px 0 0">{{ overview.collection.description }}</p>
              </div>
              <button class="btn danger" @click="deleteCollection">{{ $t('admin.delete') }}</button>
            </div>
            <div class="row-between" style="margin-top:14px">
              <span class="badge">{{ $t('admin.tokenId') }}: <strong>{{ overview.collection.tokenId }}</strong></span>
              <a :href="overview.collection.hashscanUrl" target="_blank" rel="noopener" class="btn ghost small">{{ $t('admin.hashscan') }}</a>
            </div>
          </div>

          <div class="grid">
            <article v-for="item in overview.collection.items" :key="item.id" class="card">
              <img class="card-image" :src="item.imageUrl" :alt="item.name" loading="lazy" />
              <h3>{{ item.name }}</h3>
              <div class="row-between">
                <span class="badge">{{ $t('admin.available') }}: <strong>{{ item.remaining }}</strong></span>
                <span class="badge">{{ $t('admin.sold') }}: <strong>{{ item.soldCount }}</strong></span>
              </div>
              <span class="badge">{{ $t('admin.serialRange') }}: <strong>{{ item.serialStart }}-{{ item.serialEnd }}</strong></span>
            </article>
          </div>
        </template>
      </section>

      <section v-else-if="tab === 'raffle'" class="stack">
        <div class="panel">
          <div class="row-between">
            <h2 style="margin:0; color:var(--gold)">{{ $t('admin.raffleTitle') }}</h2>
            <button class="btn" :disabled="rolling || participants.length === 0" @click="roll">
              {{ rolling ? $t('admin.rolling') : $t('admin.raffleButton') }}
            </button>
          </div>
          <p v-if="participants.length === 0" class="empty" style="padding:14px 0 0">{{ $t('admin.noBuyers') }}</p>
        </div>

        <div v-if="rolling || winner" class="panel winner" style="position:relative; overflow:hidden">
          <div v-for="piece in confettiVisible ? confetti : []" :key="`${confettiRound}-${piece.id}`" class="confetti-piece" :style="piece.style" />
          <div v-if="rolling" class="roulette-name">{{ displayName }}</div>
          <template v-else-if="winner">
            <h2>{{ $t('admin.winner') }}</h2>
            <p>{{ $t('admin.winnerName') }}: <strong>{{ winner.name }}</strong></p>
            <p class="account">{{ winner.account }}</p>
          </template>
        </div>

        <div class="panel">
          <h3 style="margin-top:0; color:var(--gold)">{{ $t('admin.recentBuyers') }}</h3>
          <div v-if="pagedBuyers.length === 0" class="empty">{{ $t('admin.noBuyers') }}</div>
          <table v-else>
            <thead>
              <tr>
                <th>{{ $t('admin.date') }}</th>
                <th>{{ $t('purchase.firstName') }}</th>
                <th>{{ $t('purchase.email') }}</th>
                <th>{{ $t('admin.items') }}</th>
                <th>{{ $t('admin.winnerAccount') }}</th>
                <th>{{ $t('purchase.serialLabel') }}</th>
                <th>{{ $t('purchase.connectedAs') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="buyer in pagedBuyers" :key="buyer.id">
                <td>{{ formatDate(buyer.created_at) }}</td>
                <td>{{ buyer.first_name }} {{ buyer.last_name }}</td>
                <td>{{ buyer.email }}</td>
                <td>{{ buyer.item_name }}</td>
                <td>{{ buyer.hedera_account_id }}</td>
                <td>{{ buyer.nft_serial }}</td>
                <td>{{ buyer.delivery_status }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="totalPages > 1" class="pager">
            <button class="btn ghost small" :disabled="page <= 1" @click="page--">{{ $t('admin.prev') }}</button>
            <span class="small-note">{{ $t('admin.page') }} {{ page }} / {{ totalPages }}</span>
            <button class="btn ghost small" :disabled="page >= totalPages" @click="page++">{{ $t('admin.next') }}</button>
          </div>
        </div>
      </section>

      <section v-else class="stack">
        <div class="panel">
          <h2 style="margin:0; color:var(--gold)">{{ $t('admin.contestTitle') }}</h2>
          <p class="small-note" style="margin:8px 0 0">{{ $t('admin.contestCount', { n: contestEntries.length }) }}</p>
        </div>
        <div class="panel">
          <div v-if="contestEntries.length === 0" class="empty">{{ $t('admin.contestEmpty') }}</div>
          <table v-else>
            <thead>
              <tr>
                <th>{{ $t('admin.date') }}</th>
                <th>{{ $t('admin.contestAccount') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in contestEntries" :key="entry.id">
                <td>{{ formatDate(entry.created_at) }}</td>
                <td>{{ entry.hedera_account_id }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
const { t, te } = useI18n()

const checking = ref(true)
const authed = ref(false)
const password = ref('')
const loggingIn = ref(false)
const loginError = ref('')
const tab = ref<'create' | 'active' | 'raffle' | 'contest'>('create')

const overview = ref<any>(null)
const buyers = ref<any[]>([])
const contestEntries = ref<any[]>([])
const page = ref(1)
const pageSize = 50

const createForm = reactive({
  description: ''
})
const createItems = ref<Array<{ id: number; name: string; file: File | null }>>([
  { id: 1, name: '', file: null }
])
let nextItemId = 2
const creating = ref(false)
const createError = ref('')
const createSuccess = ref('')

const rolling = ref(false)
const displayName = ref('')
const winner = ref<{ name: string; account: string } | null>(null)
const confetti = ref<any[]>([])
const confettiVisible = ref(false)
const confettiRound = ref(0)

const participants = computed(() => {
  const seen = new Map<string, { name: string; account: string }>()
  for (const buyer of buyers.value) {
    const account = buyer.hedera_account_id
    if (!seen.has(account)) {
      seen.set(account, {
        name: `${buyer.first_name} ${buyer.last_name}`.trim(),
        account
      })
    }
  }
  return Array.from(seen.values())
})

const totalPages = computed(() => Math.max(1, Math.ceil(buyers.value.length / pageSize)))
const pagedBuyers = computed(() => {
  const start = (page.value - 1) * pageSize
  return buyers.value.slice(start, start + pageSize)
})

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-ES')
}

function onFile(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  createItems.value[index].file = input.files?.[0] || null
}

function addItem() {
  if (createItems.value.length >= 5) return
  createItems.value.push({ id: nextItemId++, name: '', file: null })
}

function removeItem(index: number) {
  if (createItems.value.length <= 1) return
  createItems.value.splice(index, 1)
}

function adminErrorMessage(code: string) {
  const key = `admin.errors.${code}`
  return te(key) ? t(key) : t('admin.errors.generic')
}

async function loadOverview() {
  overview.value = await $fetch('/api/admin/overview')
}

async function loadBuyers() {
  const response = await $fetch('/api/admin/purchases')
  buyers.value = response?.buyers || []
  page.value = 1
}

async function login() {
  loggingIn.value = true
  loginError.value = ''
  try {
    await $fetch('/api/admin/login', {
      method: 'POST',
      body: { password: password.value }
    })
    authed.value = true
    await loadOverview()
  } catch {
    loginError.value = t('admin.wrongPassword')
  } finally {
    loggingIn.value = false
  }
}

async function logout() {
  await $fetch('/api/admin/logout', { method: 'POST' }).catch(() => undefined)
  authed.value = false
  overview.value = null
  buyers.value = []
}

async function createCollection() {
  creating.value = true
  createError.value = ''
  createSuccess.value = ''
  try {
    if (createItems.value.some((item) => !item.name.trim() || !item.file)) {
      createError.value = t('admin.itemRequired')
      return
    }

    const formData = new FormData()
    formData.append('description', createForm.description)
    createItems.value.forEach((item, index) => {
      formData.append(`name${index}`, item.name.trim())
      if (item.file) {
        formData.append(`file${index}`, item.file)
      }
    })
    const response = await $fetch('/api/admin/collections', { method: 'POST', body: formData })
    if (response?.ok) {
      createSuccess.value = t('admin.created')
      createForm.description = ''
      createItems.value = [{ id: nextItemId++, name: '', file: null }]
      tab.value = 'active'
      await loadOverview()
    } else {
      createError.value = t('admin.errors.generic')
    }
  } catch (err: any) {
    const code = String(err?.data?.error || err?.response?._data?.error || '')
    createError.value = code ? adminErrorMessage(code) : t('admin.errors.generic')
  } finally {
    creating.value = false
  }
}

async function deleteCollection() {
  if (!window.confirm(t('admin.deleteConfirm'))) return
  await $fetch('/api/admin/collection', { method: 'DELETE' })
  overview.value = null
  buyers.value = []
  await loadOverview()
}

async function openRaffle() {
  tab.value = 'raffle'
  await loadBuyers()
}

async function openContest() {
  tab.value = 'contest'
  const response = await $fetch('/api/admin/contest')
  contestEntries.value = response?.entries || []
}

function randomParticipant() {
  return participants.value[Math.floor(Math.random() * participants.value.length)]
}

function roll() {
  if (rolling.value || participants.value.length === 0) return
  rolling.value = true
  winner.value = null
  confettiVisible.value = false
  confetti.value = []
  const started = Date.now()
  const interval = window.setInterval(() => {
    displayName.value = randomParticipant().name
  }, 80)
  window.setTimeout(() => {
    window.clearInterval(interval)
    const selected = randomParticipant()
    winner.value = selected
    displayName.value = ''
    rolling.value = false
    confetti.value = Array.from({ length: 48 }, (_, index) => ({
      id: index,
      style: {
        left: `${Math.random() * 100}%`,
        background: ['#ffd166', '#ef476f', '#06d6a0', '#8ecae6', '#7b2ff7'][index % 5],
        animationDelay: `${Math.random() * 1.2}s`,
        animationDuration: `${1.8 + Math.random() * 1.4}s`
      }
    }))
    confettiRound.value += 1
    confettiVisible.value = true
    window.setTimeout(() => {
      confettiVisible.value = false
    }, 10000)
  }, Math.max(0, 10000 - (Date.now() - started)))
}

onMounted(async () => {
  try {
    await $fetch('/api/admin/me')
    authed.value = true
    await loadOverview()
    tab.value = overview.value?.collection ? 'active' : 'create'
  } catch {
    authed.value = false
  } finally {
    checking.value = false
  }
})
</script>
