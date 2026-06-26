<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowDown,
  Box,
  DataAnalysis,
  Expand,
  Fold,
  FullScreen,
  Goods,
  Link,
  List,
  Menu as MenuIcon,
  Shop,
  TrendCharts,
  Refresh,
  SwitchButton,
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const isCollapsed = ref(false)

const menus = [
  { path: '/dashboard', title: '数据概览', icon: DataAnalysis },
  { path: '/products', title: '商品管理', icon: Goods },
  { path: '/xianyu-import', title: '闲鱼导入', icon: Link },
  { path: '/inventory', title: '库存管理', icon: Box },
  { path: '/sales', title: '销售记录', icon: List },
  { path: '/accounts', title: '闲鱼账号', icon: Shop },
  { path: '/account-analysis', title: '账号分析', icon: TrendCharts },
  { path: '/categories', title: '分类管理', icon: MenuIcon },
]

const activeMenu = computed(() => route.path)
const pageTitle = computed(() => (route.meta.title as string) ?? '管理后台')

const displayName = computed(() => {
  const email = auth.user?.email ?? ''
  if (!email) return '用户'
  return email.split('@')[0]
})

const userInitial = computed(() => displayName.value.slice(0, 1).toUpperCase())

function toggleSidebar() {
  isCollapsed.value = !isCollapsed.value
}

function handleRefresh() {
  router.go(0)
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

async function handleLogout() {
  await auth.signOut()
  router.push('/login')
}
</script>

<template>
  <el-container class="layout">
    <el-aside :width="isCollapsed ? '64px' : '220px'" class="aside">
      <div class="brand" :class="{ collapsed: isCollapsed }">
        <span class="brand-mark">衣</span>
        <div v-show="!isCollapsed" class="brand-text">
          <span class="brand-title">衣服管家</span>
          <span class="brand-sub">卖家管理后台</span>
        </div>
      </div>

      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapsed"
        router
        class="sidebar-menu"
        background-color="#001529"
        text-color="rgba(255,255,255,0.72)"
        active-text-color="#fff"
      >
        <el-menu-item v-for="item in menus" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container class="main-container">
      <el-header class="header">
        <div class="header-left">
          <button type="button" class="icon-btn" @click="toggleSidebar">
            <el-icon><component :is="isCollapsed ? Expand : Fold" /></el-icon>
          </button>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item>首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ pageTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <div class="header-right">
          <button type="button" class="icon-btn" title="刷新" @click="handleRefresh">
            <el-icon><Refresh /></el-icon>
          </button>
          <button type="button" class="icon-btn" title="全屏" @click="toggleFullscreen">
            <el-icon><FullScreen /></el-icon>
          </button>

          <el-dropdown trigger="click" @command="(cmd: string) => cmd === 'logout' && handleLogout()">
            <div class="user-profile">
              <div class="user-avatar">{{ userInitial }}</div>
              <div v-show="!isCollapsed" class="user-info">
                <span class="user-name">{{ displayName }}</span>
                <el-tag v-if="auth.isSuperAdmin" size="small" type="danger" effect="dark">超管</el-tag>
              </div>
              <el-icon class="user-arrow"><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>{{ auth.user?.email }}</el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  background: #f0f2f5;
}

.aside {
  background: #001529;
  transition: width 0.2s ease;
  overflow: hidden;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.08);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 56px;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.brand.collapsed {
  justify-content: center;
  padding: 0;
}

.brand-mark {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: linear-gradient(135deg, #409eff, #337ecc);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
}

.brand-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.brand-title {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
}

.brand-sub {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  white-space: nowrap;
}

.sidebar-menu {
  border-right: none;
}

.sidebar-menu:not(.el-menu--collapse) {
  width: 220px;
}

.sidebar-menu :deep(.el-menu-item) {
  height: 48px;
  margin: 4px 8px;
  border-radius: 8px;
}

.sidebar-menu :deep(.el-menu-item.is-active) {
  background: #409eff !important;
}

.sidebar-menu :deep(.el-menu-item:hover) {
  background: rgba(255, 255, 255, 0.08) !important;
}

.main-container {
  min-width: 0;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 20px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.06);
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #606266;
  cursor: pointer;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: #f5f7fa;
  color: #409eff;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px 4px 4px;
  border-radius: 24px;
  cursor: pointer;
  transition: background 0.2s;
}

.user-profile:hover {
  background: #f5f7fa;
}

.user-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #409eff, #79bbff);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.user-name {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}

.user-arrow {
  color: #909399;
  font-size: 12px;
}

.main {
  padding: 16px;
  background: #f0f2f5;
}

@media (max-width: 768px) {
  .header-left :deep(.el-breadcrumb) {
    display: none;
  }

  .user-info {
    display: none;
  }
}
</style>
