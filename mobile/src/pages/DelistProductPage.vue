<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showFailToast, showSuccessToast } from 'vant'
import type { Product } from '@shared/types'
import { getProductCoverImage } from '@shared/productImages'
import { delistProducts, fetchActiveProducts } from '@/services/products'

const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const keyword = ref('')
const products = ref<Product[]>([])
const selectedIds = ref<string[]>([])

onMounted(loadData)

async function loadData() {
  loading.value = true
  try {
    products.value = await fetchActiveProducts(keyword.value)
  } catch (error) {
    showFailToast(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  loadData()
}

function toggleProduct(id: string) {
  const index = selectedIds.value.indexOf(id)
  if (index >= 0) {
    selectedIds.value.splice(index, 1)
  } else {
    selectedIds.value.push(id)
  }
}

function isSelected(id: string) {
  return selectedIds.value.includes(id)
}

async function handleDelist() {
  if (selectedIds.value.length === 0) {
    showFailToast('请至少选择一件商品')
    return
  }

  saving.value = true
  try {
    await delistProducts([...selectedIds.value])
    showSuccessToast(`已下架 ${selectedIds.value.length} 件商品`)
    router.replace('/')
  } catch (error) {
    showFailToast(error instanceof Error ? error.message : '下架失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page">
    <van-nav-bar title="主动下架" left-arrow @click-left="router.back()" />

    <div class="page-body">
      <div class="hint-bar">
        选择在闲鱼已主动下架的商品，系统会改为「主动下架」状态，库存保留。
      </div>

      <van-search v-model="keyword" placeholder="搜索商品名称" show-action @search="handleSearch">
        <template #action>
          <div @click="handleSearch">搜索</div>
        </template>
      </van-search>

      <van-loading v-if="loading" vertical class="page-loading">加载中...</van-loading>

      <div v-else class="product-list">
        <div
          v-for="product in products"
          :key="product.id"
          class="product-item"
          :class="{ selected: isSelected(product.id) }"
          @click="toggleProduct(product.id)"
        >
          <van-checkbox :model-value="isSelected(product.id)" icon-size="18" />
          <van-image
            v-if="getProductCoverImage(product)"
            :src="getProductCoverImage(product)!"
            width="56"
            height="56"
            radius="8"
            fit="cover"
          />
          <div v-else class="product-thumb-empty">无图</div>
          <div class="product-info">
            <div class="product-name">{{ product.name }}</div>
            <div class="product-meta">
              {{ product.account?.name ?? '未标记' }} · 库存
              {{ product.skus?.reduce((s, k) => s + k.stock, 0) ?? 0 }} 件
            </div>
          </div>
        </div>
        <van-empty v-if="products.length === 0" description="暂无在售商品" />
      </div>
    </div>

    <div class="fixed-bottom-spacer" />
    <div class="fixed-bottom">
      <van-button
        type="warning"
        block
        round
        :loading="saving"
        :disabled="selectedIds.length === 0"
        @click="handleDelist"
      >
        确认下架{{ selectedIds.length > 0 ? `（${selectedIds.length} 件）` : '' }}
      </van-button>
    </div>
  </div>
</template>

<style scoped>
.hint-bar {
  margin-bottom: 8px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #fdf6ec;
  font-size: 13px;
  color: #e6a23c;
  line-height: 1.5;
}

.product-list {
  margin-top: 8px;
}

.product-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  margin-bottom: 8px;
  border-radius: 12px;
  background: #fff;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.2s;
}

.product-item.selected {
  border-color: #e6a23c;
  background: #fdf6ec;
}

.product-thumb-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 8px;
  background: #f5f7fa;
  color: #c0c4cc;
  font-size: 12px;
  flex-shrink: 0;
}

.product-info {
  flex: 1;
  min-width: 0;
}

.product-name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.product-meta {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}
</style>
