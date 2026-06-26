import type { App } from 'vue'
import {
  ActionSheet,
  Button,
  Cell,
  CellGroup,
  Checkbox,
  Empty,
  Field,
  Icon,
  Image as VanImage,
  Loading,
  NavBar,
  Picker,
  Popup,
  Radio,
  RadioGroup,
  Search,
  Switch,
  Uploader,
} from 'vant'

const components = [
  ActionSheet,
  Button,
  Cell,
  CellGroup,
  Checkbox,
  Empty,
  Field,
  Icon,
  VanImage,
  Loading,
  NavBar,
  Picker,
  Popup,
  Radio,
  RadioGroup,
  Search,
  Switch,
  Uploader,
]

export function setupVant(app: App) {
  components.forEach((component) => app.use(component))
}
