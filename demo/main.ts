import {createApp, createComponent, Model, ComponentTemplate, Component} from '../src/index'
import m from 'mithril'

import {layoutComponent} from './components/layout'
import {homeComponent} from './components/home'
import {mainComponent as childrenMainComponent} from './components/children/main'

const renderer = (rootElement: HTMLElement, component: any) => {
    m.render(rootElement, component())
}

const initialModel = {}

const app = createApp(renderer, initialModel)

const routes = {
    '*': '/home',
    '/home': {
        name: 'Home',
        component: homeComponent
    },
    '/children': {
        name: 'Children',
        component: childrenMainComponent,
        action: () => (model: Model) => {
            const items = []
            for (let i = 0; i < 10; i++) {
                items.push({id: i, name: `Item #${i}`})
            }
            return model.set('items', items)
        }
    },
}

app.start(document.body, layoutComponent, routes)
