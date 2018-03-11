import m from 'mithril'
import {
    createTemplate,
    createComponent,
    Component,
    ComponentTemplate,
} from '../../src/index'

const layoutTemplate = createTemplate({
    sockets: ['page'],
    render: ({ model, link, outlet }) =>
        m('div.app', [
            model.page !== 'Home'
                ? m('a', { href: link('Home') }, 'Go home')
                : undefined,
            outlet(),
        ]),
})

export const layoutComponent = createComponent(
    layoutTemplate,
    {
        page: ['$router', 'current', 'name'],
    },
    'Layout',
)
