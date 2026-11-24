<template>
  <div class="modal-backdrop" @click.self="close">
    <div class="modal">
      <div class="row-between">
        <h2>{{ $t('contest.title') }}</h2>
        <button class="btn ghost small" @click="close">{{ $t('purchase.close') }}</button>
      </div>

      <div v-if="!done" class="stack">
        <form class="stack" @submit.prevent="submit">
          <p class="small-note" style="margin: 0">{{ $t('contest.intro') }}</p>
          <label class="field">
            <span>{{ $t('contest.accountLabel') }}</span>
            <input
              v-model="accountId"
              class="input"
              :placeholder="$t('contest.placeholder')"
              autocomplete="off"
            />
          </label>
          <p class="small-note" style="margin: 0">
            {{ $t('contest.below') }}
            <a href="https://hedera.com/builders-program" target="_blank" rel="noopener">{{ $t('contest.moreInfo') }}</a>
          </p>
          <div aria-hidden="true" style="position:absolute; left:-9999px; width:1px; height:1px; overflow:hidden">
            <label>
              Website
              <input v-model="website" type="text" name="website" tabindex="-1" autocomplete="off" />
            </label>
          </div>
          <div v-if="error" class="message error">{{ error }}</div>
          <div class="form-actions">
            <button class="btn" :disabled="busy">
              {{ busy ? $t('contest.sending') : $t('contest.submit') }}
            </button>
          </div>
        </form>
      </div>

      <div v-else class="winner">
        <h2>{{ $t('contest.successTitle') }}</h2>
        <p>{{ $t('contest.success') }}</p>
        <p class="account">{{ accountId }}</p>
        <div class="form-actions" style="justify-content:center">
          <button class="btn" @click="close">{{ $t('purchase.close') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()

const accountId = ref('')
const website = ref('')
const busy = ref(false)
const done = ref(false)
const error = ref('')

function close() {
  emit('close')
}

async function submit() {
  error.value = ''
  const value = accountId.value.trim()
  if (!/^0\.0\.\d+$/.test(value)) {
    error.value = t('contest.errors.invalid_account')
    return
  }
  busy.value = true
  try {
    await $fetch('/api/contest', { method: 'POST', body: { accountId: value, website: website.value } })
    done.value = true
  } catch (err: any) {
    const code = String(err?.data?.error || err?.response?._data?.error || '')
    error.value = code === 'invalid_account' ? t('contest.errors.invalid_account') : t('contest.errors.generic')
  } finally {
    busy.value = false
  }
}
</script>
