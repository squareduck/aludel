import { h, patch } from 'ultradom'
import { createRoutedApp } from '../src/index'
import { layoutComponent } from './components/layout'
import { homeComponent } from './components/home'

const routes = {
    '/': {
        name: 'Home',
        component: homeComponent,
    }
}

const app = createRoutedApp({}, routes, instance => {
    const rootElement = document.querySelector('.app')
    rootElement && patch(instance(), rootElement)
})

app()
