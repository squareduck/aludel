import m from 'mithril'
import {
    createApp,
    Component,
    ComponentTemplate,
    Route,
    Router,
} from '../src/main'

const renderer = (rootElement: HTMLElement, component: Component) => {
    m.render(rootElement, (component() as any))
}

export const app = createApp({}, renderer)
