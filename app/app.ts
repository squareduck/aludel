import m from 'mithril'
import {
    createApp,
    Component,
    ComponentTemplate,
} from '../src/main'

import { homeTpl } from './components/home'

const renderer = (rootElement: HTMLElement, component: Component) => {
    m.render(rootElement, (component() as any))
}

const app = createApp({}, renderer)

const homeComponent = app.createComponent(homeTpl, {
    userList: ['users', 'list'],
    currentUser: ['users', 'currentUser']
})

const router = app.createRouter({
    '/': {name: 'Main', component: homeComponent},
})

router.defaultRoute = 'Main'

const appElement = document.querySelector('.app')

if (appElement) app.start(<HTMLElement>appElement, router)

