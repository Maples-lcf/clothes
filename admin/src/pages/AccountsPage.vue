<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import PageContainer from '@/components/PageContainer.vue'
import TablePagination from '@/components/TablePagination.vue'
import { usePagination } from '@/composables/usePagination'
import type { AccountTrafficInvestment, SalesChannel } from '@shared/types'
import { SALES_CHANNEL_MAP } from '@shared/types'
import {
  createAccountTrafficInvestment,
  deleteAccountTrafficInvestment,
  fetchAccountTrafficInvestments,
  sumInvestments,
  updateAccountTrafficInvestment,
  type InvestmentFormData,
  type SellerAccountWithInvestments,
} from '@/services/accountInvestments'
import {
  createSellerAccount,
  deleteSellerAccount,
  fetchSellerAccounts,
  updateSellerAccount,
  type AccountFormData,
} from '@/services/accounts'
import { formatMoney } from '@/utils/money'

const loading = ref(false)
const saving = ref(false)
const accounts = ref<SellerAccountWithInvestments[]>([])
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)

const investmentDialogVisible = ref(false)
const investmentLoading = ref(false)
const investmentSaving = ref(false)
const investmentRecords = ref<AccountTrafficInvestment[]>([])
const investmentAccount = ref<SellerAccountWithInvestments | null>(null)
const editingInvestmentId = ref<string | null>(null)

const filters = reactive({
  keyword: '',
  platform: '' as SalesChannel | '',
})

const filteredAccounts = computed(() => {
  return accounts.value.filter((item) => {
    if (filters.platform && item.platform !== filters.platform) return false
    if (filters.keyword.trim()) {
      const keyword = filters.keyword.trim().toLowerCase()
      const matchName = item.name.toLowerCase().includes(keyword)
      const matchNote = item.note?.toLowerCase().includes(keyword)
      if (!matchName && !matchNote) return false
    }
    return true
  })
})

const { currentPage, pageSize, total, paginatedData } = usePagination(filteredAccounts)

const {
  currentPage: investmentCurrentPage,
  pageSize: investmentPageSize,
  total: investmentRecordTotal,
  paginatedData: paginatedInvestmentRecords,
} = usePagination(investmentRecords)

const investmentTotal = computed(() => sumInvestments(investmentRecords.value))

const form = reactive<AccountFormData>({
  name: '',
  platform: 'xianyu',
  note: null,
  is_active: true,
})

const investmentForm = reactive<Omit<InvestmentFormData, 'account_id'>>({
  amount: 0,
  invested_at: dayjs().format('YYYY-MM-DD'),
  note: null,
})

function getAccountInvestmentTotal(row: SellerAccountWithInvestments) {
  return sumInvestments(row.investments)
}

function resetFilters() {
  filters.keyword = ''
  filters.platform = ''
}

function resetForm() {
  editingId.value = null
  form.name = ''
  form.platform = 'xianyu'
  form.note = null
  form.is_active = true
}

function resetInvestmentForm() {
  editingInvestmentId.value = null
  investmentForm.amount = 0
  investmentForm.invested_at = dayjs().format('YYYY-MM-DD')
  investmentForm.note = null
}

async function loadData() {
  loading.value = true
  try {
    accounts.value = (await fetchSellerAccounts()) as SellerAccountWithInvestments[]
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

async function loadInvestmentRecords() {
  if (!investmentAccount.value) return
  investmentLoading.value = true
  try {
    investmentRecords.value = await fetchAccountTrafficInvestments(investmentAccount.value.id)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载投入记录失败')
  } finally {
    investmentLoading.value = false
  }
}

function openCreate() {
  resetForm()
  dialogVisible.value = true
}

function openEdit(row: SellerAccountWithInvestments) {
  editingId.value = row.id
  form.name = row.name
  form.platform = row.platform
  form.note = row.note
  form.is_active = row.is_active
  dialogVisible.value = true
}

async function openInvestments(row: SellerAccountWithInvestments) {
  investmentAccount.value = row
  resetInvestmentForm()
  investmentCurrentPage.value = 1
  investmentDialogVisible.value = true
  await loadInvestmentRecords()
}

function openEditInvestment(row: AccountTrafficInvestment) {
  editingInvestmentId.value = row.id
  investmentForm.amount = Number(row.amount)
  investmentForm.invested_at = row.invested_at
  investmentForm.note = row.note
}

async function handleSave() {
  if (!form.name.trim()) {
    ElMessage.warning('请填写账号名称')
    return
  }

  saving.value = true
  try {
    if (editingId.value) {
      await updateSellerAccount(editingId.value, form)
      ElMessage.success('账号已更新')
    } else {
      await createSellerAccount(form)
      ElMessage.success('账号已创建')
    }
    dialogVisible.value = false
    await loadData()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleSaveInvestment() {
  if (!investmentAccount.value) return
  if (!investmentForm.amount || investmentForm.amount <= 0) {
    ElMessage.warning('请填写投入金额')
    return
  }
  if (!investmentForm.invested_at) {
    ElMessage.warning('请选择投入日期')
    return
  }

  investmentSaving.value = true
  try {
    const payload: InvestmentFormData = {
      account_id: investmentAccount.value.id,
      amount: investmentForm.amount,
      invested_at: investmentForm.invested_at,
      note: investmentForm.note?.trim() || null,
    }

    if (editingInvestmentId.value) {
      await updateAccountTrafficInvestment(editingInvestmentId.value, payload)
      ElMessage.success('投入记录已更新')
    } else {
      await createAccountTrafficInvestment(payload)
      ElMessage.success('投入记录已添加')
    }

    resetInvestmentForm()
    await loadInvestmentRecords()
    await loadData()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    investmentSaving.value = false
  }
}

async function handleDeleteInvestment(row: AccountTrafficInvestment) {
  try {
    await ElMessageBox.confirm(`确定删除 ${row.invested_at} 的投入记录吗？`, '删除确认', {
      type: 'warning',
    })
    await deleteAccountTrafficInvestment(row.id)
    ElMessage.success('已删除')
    if (editingInvestmentId.value === row.id) {
      resetInvestmentForm()
    }
    await loadInvestmentRecords()
    await loadData()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '删除失败')
    }
  }
}

async function handleDelete(row: SellerAccountWithInvestments) {
  try {
    await ElMessageBox.confirm(`确定删除账号「${row.name}」吗？`, '删除确认', { type: 'warning' })
    await deleteSellerAccount(row.id)
    ElMessage.success('已删除')
    await loadData()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '删除失败')
    }
  }
}

onMounted(loadData)
</script>

<template>
  <PageContainer title="闲鱼账号">
    <template #actions>
      <el-button type="primary" class="btn-add" :icon="Plus" @click="openCreate">新增</el-button>
    </template>

    <template #filters>
      <el-input
        v-model="filters.keyword"
        class="filter-input"
        placeholder="账号名称 / 备注"
        clearable
        :prefix-icon="Search"
      />
      <el-select v-model="filters.platform" class="filter-select" placeholder="平台" clearable>
        <el-option v-for="(label, value) in SALES_CHANNEL_MAP" :key="value" :label="label" :value="value" />
      </el-select>
      <el-button class="filter-btn" type="primary" plain>查询</el-button>
      <el-button class="filter-btn filter-btn--ghost" @click="resetFilters">重置</el-button>
    </template>

    <el-table v-loading="loading" :data="paginatedData" class="pro-table" empty-text="还没有账号，先新增闲鱼号">
      <el-table-column label="账号名称" prop="name" min-width="140" />
      <el-table-column label="平台" width="100" align="center">
        <template #default="{ row }">
          <span class="status-tag status-tag--active">
            {{ SALES_CHANNEL_MAP[row.platform as SalesChannel] }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="累计投入" width="120" align="right">
        <template #default="{ row }">
          <span :class="{ 'investment-amount': getAccountInvestmentTotal(row) > 0 }">
            {{ formatMoney(getAccountInvestmentTotal(row)) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <span :class="row.is_active ? 'status-tag status-tag--success' : 'status-tag status-tag--sold_out'">
            {{ row.is_active ? '启用' : '停用' }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="备注" prop="note" min-width="140" show-overflow-tooltip />
      <el-table-column label="操作" width="260" align="center">
        <template #default="{ row }">
          <div class="table-actions">
            <el-button class="action-btn action-btn--edit" size="small" @click="openInvestments(row)">
              投入记录
            </el-button>
            <el-button class="action-btn action-btn--edit" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button class="action-btn action-btn--danger" size="small" @click="handleDelete(row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <TablePagination v-model:current-page="currentPage" v-model:page-size="pageSize" :total="total" />
  </PageContainer>

  <el-dialog v-model="dialogVisible" :title="editingId ? '编辑账号' : '新增账号'" width="480px">
    <el-form label-width="90px">
      <el-form-item label="账号名称" required>
        <el-input v-model="form.name" placeholder="例如：闲鱼主号、闲鱼2号" />
      </el-form-item>
      <el-form-item label="平台">
        <el-select v-model="form.platform" style="width: 100%">
          <el-option v-for="(label, value) in SALES_CHANNEL_MAP" :key="value" :label="label" :value="value" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-switch v-model="form.is_active" active-text="启用" inactive-text="停用" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.note" type="textarea" :rows="2" placeholder="例如：主要卖女装、负责清仓等" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="investmentDialogVisible"
    :title="investmentAccount ? `${investmentAccount.name} · 流量投入记录` : '流量投入记录'"
    width="960px"
    class="investment-dialog"
    destroy-on-close
  >
    <div class="investment-summary">
      <span class="investment-summary__label">累计投入</span>
      <span class="investment-summary__value">{{ formatMoney(investmentTotal) }}</span>
    </div>

    <el-form inline class="investment-form">
      <el-form-item label="投入日期" required>
        <el-date-picker
          v-model="investmentForm.invested_at"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择日期"
          style="width: 150px"
        />
      </el-form-item>
      <el-form-item label="金额" required>
        <el-input-number
          v-model="investmentForm.amount"
          :min="0"
          :precision="2"
          :step="10"
          controls-position="right"
          style="width: 140px"
        />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="investmentForm.note" placeholder="例如：曝光推广" style="width: 160px" clearable />
      </el-form-item>
      <el-form-item>
        <el-button v-if="editingInvestmentId" @click="resetInvestmentForm">取消编辑</el-button>
        <el-button type="primary" :loading="investmentSaving" @click="handleSaveInvestment">
          {{ editingInvestmentId ? '保存修改' : '添加记录' }}
        </el-button>
      </el-form-item>
    </el-form>

    <div class="investment-table-wrap">
      <el-table
        v-loading="investmentLoading"
        :data="paginatedInvestmentRecords"
        class="pro-table investment-table"
        empty-text="还没有投入记录"
      >
        <el-table-column label="投入日期" prop="invested_at" min-width="140" />
        <el-table-column label="金额" min-width="140" align="right">
          <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
        </el-table-column>
        <el-table-column label="备注" prop="note" min-width="280" show-overflow-tooltip />
        <el-table-column label="操作" width="180" align="center" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button class="action-btn action-btn--edit" size="small" @click="openEditInvestment(row)">
                编辑
              </el-button>
              <el-button class="action-btn action-btn--danger" size="small" @click="handleDeleteInvestment(row)">
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <TablePagination
        v-model:current-page="investmentCurrentPage"
        v-model:page-size="investmentPageSize"
        :total="investmentRecordTotal"
      />
    </div>
  </el-dialog>
</template>

<style scoped>
.investment-amount {
  color: #e6a23c;
  font-weight: 500;
}

.investment-summary {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #fdf6ec;
  border-radius: 8px;
}

.investment-summary__label {
  color: #909399;
  font-size: 14px;
}

.investment-summary__value {
  color: #e6a23c;
  font-size: 20px;
  font-weight: 600;
}

.investment-form {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f2f5;
}

.investment-table-wrap {
  width: 100%;
}

.investment-table {
  width: 100%;
}

.investment-table-wrap :deep(.table-pagination) {
  margin-top: 16px;
  padding: 0;
}
</style>
