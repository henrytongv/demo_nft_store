<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
function describeError(reason: any): Record<string, any> {
  if (reason == null) return { value: reason }
  if (typeof reason !== 'object') return { value: reason }
  const details: Record<string, any> = {
    name: reason.name,
    message: reason.message,
    stack: reason.stack,
    cause: reason.cause
  }
  try {
    details.properties = Object.getOwnPropertyNames(reason).reduce((acc: Record<string, any>, key) => {
      try {
        const value = (reason as any)[key]
        acc[key] = typeof value === 'object' && value !== null ? JSON.stringify(value)?.slice(0, 500) : value
      } catch {
        acc[key] = '<unreadable>'
      }
      return acc
    }, {})
  } catch {
    // ignore
  }
  return details
}

if (import.meta.client) {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[app] unhandledrejection:', describeError(event.reason))
    console.error('[app] unhandledrejection raw:', event.reason)
  })
  window.addEventListener('error', (event) => {
    console.error('[app] window error:', describeError(event.error || event.message))
  })
}
</script>
