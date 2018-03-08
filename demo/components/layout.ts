import m from 'mithril'
import {
    createTemplate,
    createComponent,
    Component,
    ComponentTemplate
} from '../../src/index'

const layoutTemplate = createTemplate({
    sockets: ['page'],
    render: ({model, outlet}) => m('div.app', [
        model.page !== 'Home' ? m('a', {href: '/#/home'}, 'Go home') : undefined,
        outlet()
    ])
})

export const layoutComponent = createComponent(layoutTemplate, {
    page: ['$router', 'current', 'name']
}, 'Layout')
