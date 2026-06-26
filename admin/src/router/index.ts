import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/LoginPage.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/AdminLayout.vue'),
      children: [
        { path: '', redirect: '/dashboard' },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/pages/DashboardPage.vue'),
          meta: { title: '数据概览' },
        },
        {
          path: 'products',
          name: 'products',
          component: () => import('@/pages/ProductsPage.vue'),
          meta: { title: '商品管理' },
        },
        {
          path: 'xianyu-import',
          name: 'xianyu-import',
          component: () => import('@/pages/XianyuImportPage.vue'),
          meta: { title: '闲鱼导入' },
        },
        {
          path: 'inventory',
          name: 'inventory',
          component: () => import('@/pages/InventoryPage.vue'),
          meta: { title: '库存管理' },
        },
        {
          path: 'sales',
          name: 'sales',
          component: () => import('@/pages/SalesPage.vue'),
          meta: { title: '销售记录' },
        },
        {
          path: 'accounts',
          name: 'accounts',
          component: () => import('@/pages/AccountsPage.vue'),
          meta: { title: '闲鱼账号' },
        },
        {
          path: 'account-analysis',
          name: 'account-analysis',
          component: () => import('@/pages/AccountAnalysisPage.vue'),
          meta: { title: '账号分析' },
        },
        {
          path: 'categories',
          name: 'categories',
          component: () => import('@/pages/CategoriesPage.vue'),
          meta: { title: '分类管理' },
        },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (auth.loading) await auth.init()

  if (to.meta.public) {
    if (auth.isLoggedIn) return '/dashboard'
    return true
  }

  if (!auth.isLoggedIn) return '/login'
  return true
})

export default router
