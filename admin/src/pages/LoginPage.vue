<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Lock, Message, User } from '@element-plus/icons-vue'
import { isSuperAdminLoginInput } from '@/config/super-admin'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const mode = ref<'login' | 'register'>('login')

const form = reactive({
  email: '',
  password: '',
  confirmPassword: '',
})

async function handleSubmit() {
  if (!isSupabaseConfigured) {
    ElMessage.error('请先配置 admin/.env.local 中的 Supabase 环境变量')
    return
  }

  const isSuperAdminLogin = mode.value === 'login' && isSuperAdminLoginInput(form.email)

  if (!isSuperAdminLogin && !form.email) {
    ElMessage.warning('请填写邮箱和密码')
    return
  }

  if (!form.password) {
    ElMessage.warning('请填写密码')
    return
  }

  if (mode.value === 'register' && form.password !== form.confirmPassword) {
    ElMessage.warning('两次密码不一致')
    return
  }

  loading.value = true
  try {
    if (mode.value === 'login') {
      if (isSuperAdminLogin) {
        await auth.signInSuperAdmin(form.password)
        ElMessage.success('超管登录成功')
      } else {
        await auth.signIn(form.email, form.password)
        ElMessage.success('登录成功')
      }
    } else {
      await auth.signUp(form.email, form.password)
      ElMessage.success('注册成功，请查收邮件验证或直接登录')
    }
    router.push('/dashboard')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <section class="login-banner">
      <div class="banner-bg">
        <div class="wave wave-1" />
        <div class="wave wave-2" />
        <div class="wave wave-3" />
      </div>

      <div class="banner-content">
        <div class="banner-logo">
          <span class="logo-icon">衣</span>
          <span class="logo-text">衣服管家</span>
        </div>
        <h2 class="banner-title">服装库存与销售管理系统</h2>
        <p class="banner-desc">商品管理 · 库存追踪 · 利润统计</p>

        <div class="banner-illustration" aria-hidden="true">
          <svg viewBox="0 0 420 320" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="48" y="72" width="220" height="150" rx="12" fill="rgba(255,255,255,0.18)" />
            <rect x="68" y="96" width="88" height="10" rx="5" fill="rgba(255,255,255,0.45)" />
            <rect x="68" y="118" width="140" height="8" rx="4" fill="rgba(255,255,255,0.28)" />
            <rect x="68" y="136" width="120" height="8" rx="4" fill="rgba(255,255,255,0.28)" />
            <rect x="68" y="168" width="72" height="28" rx="8" fill="rgba(255,255,255,0.35)" />
            <circle cx="310" cy="108" r="42" fill="rgba(255,255,255,0.22)" />
            <path
              d="M286 196c18-28 44-42 74-42 38 0 68 28 68 66 0 34-26 62-60 66H250v-90h36z"
              fill="rgba(255,255,255,0.16)"
            />
            <rect x="250" y="206" width="148" height="72" rx="14" fill="rgba(255,255,255,0.2)" />
            <rect x="270" y="226" width="56" height="32" rx="8" fill="rgba(255,255,255,0.38)" />
            <rect x="334" y="226" width="44" height="32" rx="8" fill="rgba(255,255,255,0.25)" />
          </svg>
        </div>
      </div>
    </section>

    <section class="login-panel">
      <div class="panel-inner">
        <div class="panel-brand">
          <span class="brand-mark">衣</span>
          <span class="brand-name">CLOTHES ADMIN</span>
        </div>

        <el-alert
          v-if="!isSupabaseConfigured"
          title="尚未配置 Supabase"
          type="warning"
          description="请复制 .env.example 为 admin/.env.local 并填入 Supabase URL 和 Key"
          show-icon
          :closable="false"
          class="config-alert"
        />

        <div class="mode-tabs">
          <button
            type="button"
            class="mode-tab"
            :class="{ active: mode === 'login' }"
            @click="mode = 'login'"
          >
            登录
          </button>
          <button
            type="button"
            class="mode-tab"
            :class="{ active: mode === 'register' }"
            @click="mode = 'register'"
          >
            注册
          </button>
        </div>

        <el-form class="login-form" @submit.prevent="handleSubmit">
          <el-form-item>
            <el-input
              v-model="form.email"
              size="large"
              :placeholder="mode === 'login' ? '邮箱 / admin' : '邮箱'"
              :prefix-icon="mode === 'login' && isSuperAdminLoginInput(form.email) ? User : Message"
            />
          </el-form-item>

          <el-form-item>
            <el-input
              v-model="form.password"
              size="large"
              type="password"
              show-password
              placeholder="密码"
              :prefix-icon="Lock"
            />
          </el-form-item>

          <el-form-item v-if="mode === 'register'">
            <el-input
              v-model="form.confirmPassword"
              size="large"
              type="password"
              show-password
              placeholder="确认密码"
              :prefix-icon="Lock"
            />
          </el-form-item>

          <el-button
            type="primary"
            size="large"
            native-type="submit"
            :loading="loading"
            class="submit-btn"
          >
            {{ mode === 'login' ? '登 录' : '注 册' }}
          </el-button>
        </el-form>

        <p class="panel-footer">Copyright © {{ new Date().getFullYear() }} Clothes Admin</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  min-height: 100vh;
  background: #fff;
}

.login-banner {
  position: relative;
  flex: 1.1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #409eff 0%, #337ecc 45%, #1d6fd8 100%);
}

.banner-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.wave {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
}

.wave-1 {
  width: 520px;
  height: 520px;
  top: -120px;
  left: -80px;
}

.wave-2 {
  width: 360px;
  height: 360px;
  bottom: -80px;
  right: 10%;
  background: rgba(255, 255, 255, 0.06);
}

.wave-3 {
  width: 240px;
  height: 240px;
  top: 35%;
  right: -40px;
  background: rgba(255, 255, 255, 0.1);
}

.banner-content {
  position: relative;
  z-index: 1;
  max-width: 480px;
  padding: 48px;
  color: #fff;
}

.banner-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;
}

.logo-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.2);
  font-size: 22px;
  font-weight: 700;
}

.logo-text {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 1px;
}

.banner-title {
  margin: 0 0 12px;
  font-size: 26px;
  font-weight: 600;
  line-height: 1.4;
}

.banner-desc {
  margin: 0 0 36px;
  font-size: 15px;
  opacity: 0.88;
}

.banner-illustration svg {
  width: 100%;
  max-width: 380px;
  height: auto;
}

.login-panel {
  flex: 0.9;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  background: #fff;
}

.panel-inner {
  width: 100%;
  max-width: 400px;
}

.panel-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 36px;
}

.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #409eff, #337ecc);
  color: #fff;
  font-size: 18px;
  font-weight: 700;
}

.brand-name {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #303133;
}

.config-alert {
  margin-bottom: 20px;
}

.mode-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 28px;
  border-bottom: 1px solid #ebeef5;
}

.mode-tab {
  flex: 1;
  padding: 12px 0;
  border: none;
  background: transparent;
  font-size: 15px;
  color: #909399;
  cursor: pointer;
  position: relative;
  transition: color 0.2s;
}

.mode-tab:hover {
  color: #409eff;
}

.mode-tab.active {
  color: #409eff;
  font-weight: 600;
}

.mode-tab.active::after {
  content: '';
  position: absolute;
  left: 20%;
  right: 20%;
  bottom: -1px;
  height: 2px;
  background: #409eff;
  border-radius: 2px;
}

.login-form :deep(.el-form-item) {
  margin-bottom: 22px;
}

.login-form :deep(.el-input__wrapper) {
  padding-left: 12px;
  border-radius: 8px;
  box-shadow: 0 0 0 1px #dcdfe6 inset;
}

.login-form :deep(.el-input__wrapper:hover),
.login-form :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #409eff inset;
}

.submit-btn {
  width: 100%;
  margin-top: 8px;
  border-radius: 8px;
  font-size: 16px;
  letter-spacing: 4px;
}

.panel-footer {
  margin: 32px 0 0;
  text-align: center;
  font-size: 12px;
  color: #c0c4cc;
}

@media (max-width: 960px) {
  .login-page {
    flex-direction: column;
  }

  .login-banner {
    min-height: 280px;
    flex: none;
  }

  .banner-content {
    padding: 32px 24px;
    text-align: center;
  }

  .banner-logo,
  .banner-title,
  .banner-desc {
    justify-content: center;
  }

  .banner-illustration {
    display: none;
  }

  .login-panel {
    flex: 1;
    padding-top: 24px;
  }
}
</style>
