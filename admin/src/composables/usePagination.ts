import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'

export function usePagination<T>(source: Ref<T[]> | ComputedRef<T[]>, defaultPageSize = 10) {
  const currentPage = ref(1)
  const pageSize = ref(defaultPageSize)

  const total = computed(() => source.value.length)

  const paginatedData = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value
    return source.value.slice(start, start + pageSize.value)
  })

  watch(
    () => source.value,
    () => {
      currentPage.value = 1
    },
  )

  watch(total, () => {
    const maxPage = Math.max(1, Math.ceil(total.value / pageSize.value))
    if (currentPage.value > maxPage) {
      currentPage.value = maxPage
    }
  })

  return {
    currentPage,
    pageSize,
    total,
    paginatedData,
  }
}
