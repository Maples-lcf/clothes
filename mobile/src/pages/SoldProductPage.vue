<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { showFailToast, showSuccessToast } from 'vant'
import type { Product, ProductSku } from '@shared/types'
import { getProductCoverImage } from '@shared/productImages'
import { fetchActiveProducts, fetchActiveXianyuAccounts, getSkuLabel } from '@/services/products'
import { soldAndDelist } from '@/services/sales'
import { calcXianyuFee, formatMoney } from '@/utils/money'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const saving = ref(false)
const keyword = ref('')
const products = ref<Product[]>([])
const accounts = ref<Array<{ id: string; name: string }>>([])
const selectedProduct = ref<Product | null>(null)
const selectedSku = ref<ProductSku | null>(null)
const showSkuPicker = ref(false)
const showAccountPicker = ref(false)

const form = reactive({
  sale_amount: '',
  shipping_fee: '0',
  platform_fee: '',
  account_id: '',
  account_name: '',
  sold_at: dayjs().format('YYYY-MM-DD'),
})

const estimatedProfit = computed(() => {
  if (!selectedSku.value) return 0
  const amount = Number(form.sale_amount) || 0
  const unitCost =
    selectedProduct.value?.source_type === 'own' ? 0 : Number(selectedSku.value.cost_price) || 0
  return (
    amount -
    unitCost -
    (Number(form.platform_fee) || 0) -
    (Number(form.shipping_fee) || 0)
  )
})

const accountColumns = computed(() =>
  accounts.value.map((item) => ({ text: item.name, value: item.id })),
)

const skuOptions = computed(() => selectedProduct.value?.skus ?? [])

onMounted(loadData)

async function loadData() {
  loading.value = true
  try {
    const [list, accs] = await Promise.all([
      fetchActiveProducts(keyword.value),
      fetchActiveXianyuAccounts(),
    ])
    products.value = list
    accounts.value = accs
    if (!form.account_id && accs[0]) {
      form.account_id = accs[0].id
      form.account_name = accs[0].name
    }

    const productId = route.query.productId
    if (typeof productId === 'string') {
      const product = list.find((item) => item.id === productId)
      if (product) selectProduct(product)
    }
  } catch (error) {
    showFailToast(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  loadData()
}

function selectProduct(product: Product) {
  selectedProduct.value = product
  const skus = product.skus ?? []
  if (skus.length === 1) {
    selectSku(skus[0]!)
  } else if (skus.length > 1) {
    showSkuPicker.value = true
  } else {
    showFailToast('该商品没有可用规格')
  }
}

function selectSku(sku: ProductSku) {
  selectedSku.value = sku
  showSkuPicker.value = false
  form.sale_amount = String(sku.sell_price || '')
  form.platform_fee = String(calcXianyuFee(Number(sku.sell_price) || 0))
  if (productAccountId.value) {
    form.account_id = productAccountId.value
    form.account_name = productAccountName.value
  }
}

const productAccountId = computed(() => selectedProduct.value?.account_id ?? '')
const productAccountName = computed(() => selectedProduct.value?.account?.name ?? '')

function onAccountConfirm({ selectedOptions }: { selectedOptions: Array<{ text: string; value: string }> }) {
  form.account_id = selectedOptions[0]?.value ?? ''
  form.account_name = selectedOptions[0]?.text ?? ''
  showAccountPicker.value = false
}

function onAmountChange() {
  const amount = Number(form.sale_amount) || 0
  form.platform_fee = String(calcXianyuFee(amount))
}

async function handleSave() {
  if (!selectedProduct.value || !selectedSku.value) {
    showFailToast('请先选择商品')
    return
  }
  const amount = Number(form.sale_amount)
  if (!amount || amount <= 0) {
    showFailToast('请填写实际成交价')
    return
  }
  if (!form.account_id) {
    showFailToast('请选择闲鱼账号')
    return
  }

  saving.value = true
  try {
    const unitCost =
      selectedProduct.value.source_type === 'own' ? 0 : Number(selectedSku.value.cost_price) || 0

    await soldAndDelist(
      {
        sku_id: selectedSku.value.id,
        channel: 'xianyu',
        account_id: form.account_id,
        quantity: 1,
        sale_amount: amount,
        unit_cost: unitCost,
        platform_fee: Number(form.platform_fee) || 0,
        shipping_fee: Number(form.shipping_fee) || 0,
        other_fee: 0,
        sold_at: form.sold_at,
        note: null,
        order_status: 'success',
      },
      selectedProduct.value.id,
    )

    showSuccessToast('已记账并下架')
    router.replace('/')
  } catch (error) {
    showFailToast(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page">
    <van-nav-bar title="售出下架" left-arrow @click-left="router.back()" />

    <div class="page-body">
      <van-search v-model="keyword" placeholder="搜索商品名称" show-action @search="handleSearch">
        <template #action>
          <div @click="handleSearch">搜索</div>
        </template>
      </van-search>

      <van-loading v-if="loading" vertical class="page-loading">加载中...</van-loading>

      <div v-else-if="!selectedProduct" class="product-list">
        <div
          v-for="product in products"
          :key="product.id"
          class="product-item"
          @click="selectProduct(product)"
        >
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
          <van-icon name="arrow" color="#c0c4cc" />
        </div>
        <van-empty v-if="products.length === 0" description="暂无在售商品" />
      </div>

      <template v-else>
        <div class="selected-card">
          <div class="selected-label">已选商品</div>
          <div class="selected-name">
            {{ getSkuLabel(selectedSku!, selectedProduct) }}
          </div>
          <van-button size="small" plain type="primary" @click="selectedProduct = null; selectedSku = null">
            重新选择
          </van-button>
        </div>

        <div class="section-card">
          <van-cell-group inset>
            <van-field
              v-model="form.sale_amount"
              label="实际成交价"
              type="number"
              placeholder="买家付的钱"
              required
              @update:model-value="onAmountChange"
            />
            <van-field v-model="form.shipping_fee" label="运费" type="number" placeholder="你出的邮费" />
            <van-field v-model="form.platform_fee" label="平台服务费" type="number" placeholder="闲鱼约 0.6%" />
            <van-cell
              title="成交账号"
              :value="form.account_name || '请选择'"
              is-link
              required
              @click="showAccountPicker = true"
            />
            <van-cell title="预计利润">
              <template #value>
                <span :class="estimatedProfit >= 0 ? 'profit-positive' : 'profit-negative'">
                  {{ formatMoney(estimatedProfit) }}
                </span>
              </template>
            </van-cell>
          </van-cell-group>
        </div>
      </template>
    </div>

    <div v-if="selectedProduct" class="fixed-bottom-spacer" />
    <div v-if="selectedProduct" class="fixed-bottom">
      <van-button type="primary" block round :loading="saving" @click="handleSave">
        确认售出并下架
      </van-button>
    </div>

    <van-action-sheet
      v-model:show="showSkuPicker"
      title="选择规格"
      :actions="skuOptions.map((s) => ({ name: `${s.color} / ${s.size}（库存 ${s.stock}）`, sku: s }))"
      @select="(action: { sku: ProductSku }) => selectSku(action.sku)"
    />

    <van-popup v-model:show="showAccountPicker" position="bottom" round>
      <van-picker :columns="accountColumns" @confirm="onAccountConfirm" @cancel="showAccountPicker = false" />
    </van-popup>
  </div>
</template>

<style scoped>
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
  cursor: pointer;
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

.selected-card {
  margin: 12px 0;
  padding: 16px;
  border-radius: 12px;
  background: #ecf5ff;
}

.selected-label {
  font-size: 12px;
  color: #409eff;
}

.selected-name {
  margin: 6px 0 10px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
</style>
