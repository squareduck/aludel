import { h } from 'ultradom'
import { createTemplate, createComponent, Component } from '../../src/index'
import { createLink } from '../utils/render'

function isActive(routeName, linkName) {
    if (routeName === linkName) return 'active'
    return ''
}

function createNavbar(l, routeName) {
    const items = [
        l('About', {}, { class: isActive(routeName, 'About') }, 'About'),
        l('About', {}, { class: isActive(routeName, 'Guide') }, 'Guide'),
        l('About', {}, { class: isActive(routeName, 'Demo') }, 'Demo'),
        l('About', {}, { class: isActive(routeName, 'Code') }, 'Code'),
    ]

    if (routeName !== 'Home') {
        return [l('Home', {}, { class: 'logo' }, 'Aludel'), ...items]
    }
    return items
}

const layoutTemplate = createTemplate({
    sockets: ['routeName'],
    render: ({ model, outlet, navigate, link }) => {
        const l = (route, params, props, name) =>
            createLink(route, params, props, name, navigate, link)

        return h('div', { class: 'app' }, [
            h('div', { class: 'navbar' }, createNavbar(l, model.routeName)),
            h('div', {
                class:
                    'navborder ' + (model.routeName !== 'Home' ? 'active' : ''),
            }),
            outlet(),
        ])
    },
})

export const layoutComponent = createComponent(layoutTemplate, {
    routeName: ['$app', 'route', 'name'],
})
