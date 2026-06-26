<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import PageContainer from '@/components/PageContainer.vue'
import TablePagination from '@/components/TablePagination.vue'
import { usePagination } from '@/composables/usePagination'
import type { Category } from '@shared/types'
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
} from '@/services/categories'

const loading = ref(false)
const saving = ref(false)
const categories = ref<Category[]>([])
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)

const filters = reactive({
  keyword: '',
})

const filteredCategories = computed(() => {
  if (!filters.keyword.trim()) return categories.value
  const keyword = filters.keyword.trim().toLowerCase()
  return categories.value.filter((item) => item.name.toLowerCase().includes(keyword))
})

const { currentPage, pageSize, total, paginatedData } = usePagination(filteredCategories)

const form = reactive({
  name: '',
  sort_order: 0,
})

function resetFilters() {
  filters.keyword = ''
}

async function loadData() {
  loading.value = true
  try {
    categories.value = await fetchCategories()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  form.name = ''
  form.sort_order = categories.value.length + 1
  dialogVisible.value = true
}

function openEdit(row: Category) {
  editingId.value = row.id
  form.name = row.name
  form.sort_order = row.sort_order
  dialogVisible.value = true
}

async function handleSave() {
  if (!form.name.trim()) {
    ElMessage.warning('请填写分类名称')
    return
  }

  saving.value = true
  try {
    if (editingId.value) {
      await updateCategory(editingId.value, form)
      ElMessage.success('分类已更新')
    } else {
      await createCategory(form.name, form.sort_order)
      ElMessage.success('分类已创建')
    }
    dialogVisible.value = false
    await loadData()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: Category) {
  try {
    await ElMessageBox.confirm(`确定删除分类「${row.name}」吗？`, '删除确认', { type: 'warning' })
    await deleteCategory(row.id)
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
  <PageContainer title="分类管理">
    <template #actions>
      <el-button type="primary" class="btn-add" :icon="Plus" @click="openCreate">新增</el-button>
    </template>

    <template #filters>
      <el-input
        v-model="filters.keyword"
        class="filter-input"
        placeholder="分类名称"
        clearable
        :prefix-icon="Search"
      />
      <el-button class="filter-btn" type="primary" plain>查询</el-button>
      <el-button class="filter-btn filter-btn--ghost" @click="resetFilters">重置</el-button>
    </template>

    <el-table v-loading="loading" :data="paginatedData" class="pro-table" empty-text="暂无分类">
      <el-table-column label="名称" prop="name" min-width="200" />
      <el-table-column label="排序" prop="sort_order" width="120" align="center" />
      <el-table-column label="操作" width="180" align="center">
        <template #default="{ row }">
          <div class="table-actions">
            <el-button class="action-btn action-btn--edit" size="small" @click="openEdit(row)">
              编辑
            </el-button>
            <el-button class="action-btn action-btn--danger" size="small" @click="handleDelete(row)">
              删除
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <TablePagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :total="total"
    />
  </PageContainer>

  <el-dialog v-model="dialogVisible" :title="editingId ? '编辑分类' : '新增分类'" width="420px">
    <el-form label-width="80px">
      <el-form-item label="名称" required>
        <el-input v-model="form.name" />
      </el-form-item>
      <el-form-item label="排序">
        <el-input-number v-model="form.sort_order" :min="0" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>
</template>
