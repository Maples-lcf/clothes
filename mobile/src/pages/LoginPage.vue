<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Field } from 'vant'
import { showFailToast, showSuccessToast } from 'vant'
import { isSuperAdminLoginInput } from '@/config/super-admin'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const email = ref('')
const password = ref('')

async function handleLogin() {
  if (!isSupabaseConfigured) {
    showFailToast('请先配置 .env.local')
    return
  }
  if (!password.value) {
    showFailToast('请填写密码')
    return
  }

  loading.value = true
  try {
    if (isSuperAdminLoginInput(email.value)) {
      await auth.signInSuperAdmin(password.value)
    } else {
      if (!email.value) {
        showFailToast('请填写邮箱')
        return
      }
      await auth.signIn(email.value, password.value)
    }
    showSuccessToast('登录成功')
    router.replace('/')
  } catch (error) {
    showFailToast(error instanceof Error ? error.message : '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-header">
      <div class="logo">衣</div>
      <h1>衣服管家</h1>
      <p>随手记 · 闲鱼同步助手</p>
    </div>

    <div class="login-card">
      <div class="login-card-title">登录</div>

      <div class="field-block">
        <label class="field-label">账号</label>
        <Field v-model="email" placeholder="邮箱或 admin" clearable />
      </div>

      <div class="field-block">
        <label class="field-label">密码</label>
        <Field v-model="password" type="password" placeholder="请输入密码" clearable />
      </div>

      <Button
        type="primary"
        block
        round
        size="large"
        :loading="loading"
        class="login-btn"
        @click="handleLogin"
      >
        登录
      </Button>

      <p class="login-tip">与电脑后台共用同一账号</p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  padding: 56px 20px 24px;
  background: linear-gradient(180deg, #409eff 0%, #409eff 200px, #f5f7fa 200px);
}

.login-header {
  text-align: center;
  color: #fff;
  margin-bottom: 28px;
}

.logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.22);
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 14px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.login-header h1 {
  margin: 0 0 6px;
  font-size: 26px;
  font-weight: 700;
}

.login-header p {
  margin: 0;
  opacity: 0.9;
  font-size: 14px;
}

.login-card {
  padding: 24px 20px 28px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.login-card-title {
  margin-bottom: 20px;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.field-block {
  margin-bottom: 16px;
}

.field-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #606266;
}

.field-block :deep(.van-cell) {
  padding: 12px 14px;
  background: #f5f7fa;
  border-radius: 10px;
}

.field-block :deep(.van-cell::after) {
  display: none;
}

.login-btn {
  margin-top: 8px;
  height: 46px;
  font-size: 16px;
  font-weight: 600;
}

.login-tip {
  margin: 16px 0 0;
  text-align: center;
  font-size: 12px;
  color: #909399;
}
</style>
