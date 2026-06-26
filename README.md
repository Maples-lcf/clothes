# 衣服管家

帮姐姐管理闲鱼卖货的 **商品、库存、销售与利润** 的后台系统。

## 技术栈

| 层级 | 技术 |
|------|------|
| 管理后台 | Vue 3 + Vite + Element Plus + Pinia |
| 后端 | Supabase（PostgreSQL + Auth + Storage） |
| 共享类型 | `shared/types.ts`（后期小程序可直接复用） |

## 项目结构

```text
clothes/
├── admin/                 # Vue 管理后台
├── mobile/                # H5 随手记（姐姐手机同步闲鱼操作）
├── shared/types.ts        # 前后端共享 TypeScript 类型
├── supabase/migrations/   # 数据库 SQL
├── docs/                  # 产品文档、操作手册、移动端方案
└── .env.example           # 环境变量示例
```

## 快速开始

### 1. 创建 Supabase 项目

1. 打开 [supabase.com](https://supabase.com) 注册并新建项目
2. 进入 **SQL Editor**，执行 `supabase/migrations/001_initial.sql`
3. 进入 **Authentication → Providers**，开启 Email 登录
4. 进入 **Project Settings → API**，复制 URL 和 `anon` key

### 2. 配置环境变量

```bash
cp .env.example admin/.env.local
```

编辑 `admin/.env.local`：

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 3. 启动管理后台

```bash
cd admin
npm install
npm run dev
```

浏览器打开 http://localhost:5173 ，注册账号后即可使用。

### 4. 启动 H5 随手记（姐姐手机用）

```bash
cd mobile
cp ../admin/.env.local .env.local   # 共用 Supabase 配置
npm install
npm run dev
```

手机浏览器或微信内打开 http://localhost:5174（局域网访问用电脑 IP:5174）。

支持三个快捷操作：**上新**、**售出下架**、**主动下架**。详见 [docs/移动端方案.md](./docs/移动端方案.md)。

## 功能说明

| 页面 | 功能 |
|------|------|
| 数据概览 | 本月销售额/利润、库存货值、低库存预警 |
| 商品管理 | 商品 + SKU（颜色/尺码/进价/售价/库存）+ 图片上传 |
| 闲鱼导入 | 粘贴分享链接快速建商品 |
| 库存管理 | 入库/出库/调整、变动记录 |
| 销售记录 | 闲鱼成交手动录入，自动算利润、扣库存 |
| 闲鱼账号 | 多账号管理 + 流量投入 |
| 账号分析 | 各号对比 + 改进建议 |
| 分类管理 | 上衣/裤子/裙子等分类 |

### H5 随手记（mobile/）

| 页面 | 功能 |
|------|------|
| 上新 | 拍照 + 填信息 → 同步到商品管理 |
| 售出下架 | 选商品 + 填成交价 → 记销售 + 下架 |
| 主动下架 | 多选在售商品 → 改主动下架 |

### 利润计算公式

```text
利润 = 成交额 - 进价 × 数量 - 平台费 - 运费 - 其他费用
```

闲鱼录入时会按 **0.6%** 自动估算平台服务费，可手动修改。

## 后期做小程序方便吗？

**方便。** 当前架构就是为扩展准备的：

1. **同一套 Supabase 数据库** — 小程序用 `uni-app` 或原生微信开发，调同一个 Supabase 项目
2. **共享类型** — `shared/types.ts` 可直接复制到小程序项目
3. **RLS 已预留** — SQL 里已为 `anon` 角色配置了「只读上架商品」策略，小程序展示商品列表时可直接用
4. **管理后台与小程序分离** — 后台用 `authenticated` 权限写数据，小程序用 `anon` 权限读商品

后期典型路径：

```text
第一期（现在）  管理后台 + H5 随手记录入商品/记销售
第二期 A        H5 部署上线，姐姐微信里直接用
第二期 B        闲衣小筑 uni-app 小程序（商品展示）
第三期          小程序下单 + 微信支付
```

## 部署（可选）

**前端**：推送到 GitHub 后，用 [Vercel](https://vercel.com) 导入 `admin` 目录，配置同样的环境变量。

**后端**：Supabase 云端托管，无需自己买服务器。

## 注意事项

- 闲鱼没有开放 API，销售记录需**手动录入**
- 删除销售记录**不会**自动恢复库存（避免误操作导致数据混乱）
- 首次注册后若 Supabase 开启了邮箱验证，需到邮箱点确认链接
