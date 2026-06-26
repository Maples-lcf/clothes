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
      name: 'home',
      component: () => import('@/pages/HomePage.vue'),
    },
    {
      path: '/new',
      name: 'new',
      component: () => import('@/pages/NewProductPage.vue'),
      meta: { title: '上新' },
    },
    {
      path: '/sold',
      name: 'sold',
      component: () => import('@/pages/SoldProductPage.vue'),
      meta: { title: '售出下架' },
    },
    {
      path: '/delist',
      name: 'delist',
      component: () => import('@/pages/DelistProductPage.vue'),
      meta: { title: '主动下架' },
    },
    {
      path: '/active',
      name: 'active',
      component: () => import('@/pages/ActiveProductsPage.vue'),
      meta: { title: '在售列表' },
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (auth.loading) await auth.init()

  if (to.meta.public) {
    if (auth.isLoggedIn) return '/'
    return true
  }

  if (!auth.isLoggedIn) return '/login'
  return true
})

export default router
