import m from 'mithril'
import {
    createTemplate,
    createComponent,
    Component,
    ComponentTemplate,
} from '../../src/index'

const layoutTemplate = createTemplate({
    sockets: ['page'],
    render: ({ model, link, navigate, outlet }) =>
        m('div.app', [
            model.page !== 'Home'
                ? m('a', { href: link('Home'), onclick: navigate('Home') }, 'Go home')
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
