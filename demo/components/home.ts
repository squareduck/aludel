import m from 'mithril'
import {
    createTemplate,
    createComponent,
    Component,
    ComponentTemplate,
} from '../../src/index'

const homeTemplate = createTemplate({
    render: ({ link }) => [
        m('h1', 'Aludel demo app'),
        m(
            'span',
            'Open your browser console to see when notable events happen',
        ),
        m('br'),
        m('span', 'Choose demo:'),
        m('a', { href: link('Children') }, 'Children components'),
        m('a', { href: link('Subroutes') }, 'Subroutes'),
        m('a', { href: link('Promises') }, 'Promises'),
    ],
})

export const homeComponent = createComponent(homeTemplate, {}, 'Home')
