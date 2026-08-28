import { mount } from 'svelte'
import App from './App.svelte'
import './styles/app.css'

const target = document.getElementById('app')
if (!target) throw new Error('#app が見つかりません')

export default mount(App, { target })
