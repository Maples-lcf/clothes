<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant'
import type { Product } from '@shared/types'
import { getProductCoverImage } from '@shared/productImages'
import { delistProducts, fetchActiveProducts } from '@/services/products'
import { formatMoney } from '@/utils/money'

const router = useRouter()
const loading = ref(false)
const delistingId = ref<string | null>(null)
const keyword = ref('')
const products = ref<Product[]>([])

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

function getStock(product: Product) {
  return product.skus?.reduce((sum, sku) => sum + sku.stock, 0) ?? 0
}

function getSellPrice(product: Product) {
  const skus = product.skus ?? []
  if (skus.length === 0) return 0
  return Math.min(...skus.map((sku) => Number(sku.sell_price) || 0))
}

function handleSold(product: Product) {
  router.push({ path: '/sold', query: { productId: product.id } })
}

async function handleDelist(product: Product) {
  try {
    await showConfirmDialog({
      title: '确认主动下架',
      message: `「${product.name}」将改为主动下架，库存保留。`,
    })
  } catch {
    return
  }

  delistingId.value = product.id
  try {
    await delistProducts([product.id])
    showSuccessToast('已主动下架')
    products.value = products.value.filter((item) => item.id !== product.id)
  } catch (error) {
    showFailToast(error instanceof Error ? error.message : '下架失败')
  } finally {
    delistingId.value = null
  }
}
</script>

<template>
  <div class="page">
    <van-nav-bar title="在售列表" left-arrow @click-left="router.back()" />

    <div class="page-body">
      <div class="summary-bar">
        共 <strong>{{ products.length }}</strong> 件在售
      </div>

      <van-search v-model="keyword" placeholder="搜索商品名称" show-action @search="handleSearch">
        <template #action>
          <div @click="handleSearch">搜索</div>
        </template>
      </van-search>

      <van-loading v-if="loading" vertical class="page-loading">加载中...</van-loading>

      <div v-else class="product-list">
        <div v-for="product in products" :key="product.id" class="product-card">
          <div class="product-main">
            <van-image
              v-if="getProductCoverImage(product)"
              :src="getProductCoverImage(product)!"
              width="64"
              height="64"
              radius="8"
              fit="cover"
            />
            <div v-else class="product-thumb-empty">无图</div>
            <div class="product-info">
              <div class="product-name">{{ product.name }}</div>
              <div class="product-meta">
                {{ product.account?.name ?? '未标记' }} · 库存 {{ getStock(product) }} 件
              </div>
              <div class="product-price">{{ formatMoney(getSellPrice(product)) }}</div>
            </div>
          </div>
          <div class="product-actions">
            <van-button
              size="small"
              type="success"
              plain
              round
              @click="handleSold(product)"
            >
              售出下架
            </van-button>
            <van-button
              size="small"
              type="warning"
              plain
              round
              :loading="delistingId === product.id"
              @click="handleDelist(product)"
            >
              主动下架
            </van-button>
          </div>
        </div>
        <van-empty v-if="products.length === 0" description="暂无在售商品" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.summary-bar {
  margin-bottom: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  background: #ecf5ff;
  font-size: 14px;
  color: #606266;
  text-align: center;
}

.summary-bar strong {
  color: #409eff;
}

.product-list {
  margin-top: 8px;
}

.product-card {
  margin-bottom: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.product-main {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.product-thumb-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
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

.product-price {
  margin-top: 6px;
  font-size: 16px;
  font-weight: 600;
  color: #409eff;
}

.product-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f2f5;
}
</style>
