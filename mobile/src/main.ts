import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { setupVant } from './plugins/vant'
import 'vant/lib/index.css'
import './style.css'

const app = createApp(App)
setupVant(app)
app.use(createPinia())
app.use(router)
app.mount('#app')
