import { patch } from 'ultradom'
import { createRoutedApp } from '../src/index'
import { layoutComponent } from './components/layout'
import { homeComponent } from './components/home'
import { aboutComponent } from './components/about'

const routes = {
    '/': {
        name: 'Home',
        component: homeComponent,
    },
    '/about': {
        name: 'About',
        component: aboutComponent,
    }
}

const app = createRoutedApp({}, {routes, layoutComponent}, instance => {
    const rootElement = document.querySelector('.app')
    rootElement && patch(instance(), rootElement)
})

app()
