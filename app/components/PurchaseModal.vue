<template>
  <div class="modal-backdrop" @click.self="close">
    <div class="modal">
      <div class="row-between">
        <h2>{{ $t('purchase.title') }}</h2>
        <button class="btn ghost small" @click="close">{{ $t('purchase.close') }}</button>
      </div>

      <div class="steps">
        <span class="step" :class="{ active: step === 'form' }">{{ $t('purchase.stepData') }}</span>
        <span class="step" :class="{ active: step === 'wallet' }">{{ $t('purchase.stepWallet') }}</span>
        <span class="step" :class="{ active: step === 'done' }">{{ $t('purchase.stepDone') }}</span>
      </div>

      <div v-if="step === 'form'" class="stack">
        <div class="form-grid">
          <label class="field">
            <span>{{ $t('purchase.firstName') }} *</span>
            <input v-model="form.firstName" class="input" autocomplete="given-name" />
          </label>
          <label class="field">
            <span>{{ $t('purchase.lastName') }} *</span>
            <input v-model="form.lastName" class="input" autocomplete="family-name" />
          </label>
          <label class="field">
            <span>{{ $t('purchase.email') }} *</span>
            <input v-model="form.email" class="input" type="email" autocomplete="email" />
          </label>
          <label class="field">
            <span>{{ $t('purchase.industry') }} {{ $t('purchase.optional') }}</span>
            <select v-model="form.industry" class="select">
              <option value="">—</option>
              <option v-for="option in industries" :key="option" :value="option">{{ option }}</option>
            </select>
          </label>
          <label class="field">
            <span>{{ $t('purchase.jobRole') }} {{ $t('purchase.optional') }}</span>
            <select v-model="form.jobRole" class="select">
              <option value="">—</option>
              <option v-for="option in jobRoles" :key="option" :value="option">{{ option }}</option>
            </select>
          </label>
          <label class="field">
            <span>{{ $t('purchase.interests') }} {{ $t('purchase.optional') }}</span>
            <select v-model="form.interests" class="select" multiple size="4" @change="onInterestsChange">
              <option v-for="option in interestOptions" :key="option" :value="option">{{ option }}</option>
            </select>
          </label>
        </div>

        <div v-if="error" class="message error">{{ error }}</div>
        <div class="form-actions">
          <button class="btn" :disabled="busy" @click="goToWallet">
            {{ busy ? $t('purchase.processing') : $t('purchase.continue') }}
          </button>
        </div>
      </div>

      <div v-else-if="step === 'wallet'" class="stack">
        <div class="panel" style="background: rgba(0,0,0,0.22)">
          <p style="margin-top: 0">{{ $t('purchase.subtitle') }}</p>
          <div class="row-between">
            <span class="badge">{{ $t('purchase.connectedAs') }}: <strong>{{ accountId || '—' }}</strong></span>
            <button class="btn secondary" :disabled="wallet.connecting.value" @click="connectWallet">
              {{ wallet.connecting.value ? $t('purchase.processing') : $t('purchase.connectWallet') }}
            </button>
          </div>
        </div>

        <div v-if="error" class="message error">{{ error }}</div>
        <div class="form-actions">
          <button class="btn secondary" :disabled="busy" @click="step = 'form'">{{ $t('purchase.back') }}</button>
          <button class="btn" :disabled="busy || !accountId" @click="pay">
            {{ busy ? $t('purchase.processing') : $t('purchase.pay') }}
          </button>
        </div>
      </div>

      <div v-else class="winner">
        <h2>{{ $t('purchase.successTitle') }}</h2>
        <p>{{ result?.item?.name }} — {{ $t('purchase.serialLabel') }} {{ result?.item?.serial }}</p>
        <p>{{ $t('purchase.accountLabel') }}: <strong>{{ result?.buyer?.hedera_account_id }}</strong></p>
        <div v-if="result?.delivery?.pending" class="message warning" style="text-align:left">
          <strong>{{ $t('purchase.pendingTitle') }}</strong>
          <p style="margin: 8px 0 0">{{ $t('purchase.pendingText') }}</p>
        </div>
        <div v-else class="message success" style="text-align:left">{{ $t('purchase.successText') }}</div>
        <div class="form-actions" style="justify-content:center">
          <button class="btn" @click="close">{{ $t('purchase.close') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ item: any }>()
const emit = defineEmits<{ close: []; purchased: [] }>()
const { t, tm, rt } = useI18n()
const wallet = useWallet()

const step = ref<'form' | 'wallet' | 'done'>('form')
const busy = ref(false)
const error = ref('')
const accountId = wallet.accountId
const result = ref<any>(null)

const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  industry: '',
  jobRole: '',
  interests: [] as string[]
})

function messageList(key: string): string[] {
  const entries = tm(key) as unknown
  if (!Array.isArray(entries)) return []
  return entries.map((entry: any) => (typeof entry === 'string' ? entry : rt(entry)))
}

const industries = computed(() => messageList('options.industry'))
const interestOptions = computed(() => messageList('options.interests'))
const jobRoles = computed(() => messageList('options.jobRole'))

function onInterestsChange(event: Event) {
  const select = event.target as HTMLSelectElement
  form.interests = Array.from(select.selectedOptions).map((option) => option.value)
}

function close() {
  emit('close')
}

function validateForm() {
  if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
    error.value = t('purchase.errors.required')
    return false
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    error.value = t('purchase.errors.email')
    return false
  }
  error.value = ''
  return true
}

function goToWallet() {
  if (!validateForm()) return
  step.value = 'wallet'
}

async function connectWallet() {
  busy.value = true
  error.value = ''
  try {
    await wallet.connect()
  } catch (err: any) {
    error.value = t('purchase.errors.wallet')
  } finally {
    busy.value = false
  }
}

function safeErrorText(value: any): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  try {
    if (typeof value === 'object' && typeof value.message === 'string') return value.message
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

function apiErrorCode(err: any) {
  return safeErrorText(
    err?.data?.error || err?.response?._data?.error || err?.data?.statusMessage || err?.statusMessage || ''
  )
}

function mapApiError(code: string) {
  const map: Record<string, string> = {
    required_fields: 'purchase.errors.required',
    invalid_email: 'purchase.errors.email',
    duplicate_payment: 'purchase.errors.duplicate',
    out_of_stock: 'purchase.errors.outOfStock',
    payment_not_found: 'purchase.errors.payment',
    payment_failed: 'purchase.errors.payment',
    payment_amount_invalid: 'purchase.errors.payment',
    payment_payer_mismatch: 'purchase.errors.payment',
    no_collection: 'purchase.errors.generic',
    item_not_found: 'purchase.errors.generic'
  }
  return t(map[code] || 'purchase.errors.generic')
}

async function pay() {
  busy.value = true
  error.value = ''
  try {
    if (!accountId.value) {
      await wallet.connect()
    }
    console.debug('[purchase] requesting wallet signature')
    const transactionId = await wallet.payOneHbar()
    console.debug('[purchase] wallet returned transactionId', transactionId)
    const response = await $fetch('/api/purchase', {
      method: 'POST',
      body: {
        itemId: props.item.id,
        transactionId,
        payerAccountId: accountId.value,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        industry: form.industry || null,
        interests: form.interests,
        jobRole: form.jobRole || null
      }
    })
    result.value = response
    step.value = 'done'
    emit('purchased')
  } catch (err: any) {
    console.debug('[purchase] pay error', err)
    const code = apiErrorCode(err)
    if (code) {
      error.value = mapApiError(code)
    } else {
      error.value = t('purchase.errors.paymentRejected')
    }
  } finally {
    busy.value = false
  }
}
</script>
