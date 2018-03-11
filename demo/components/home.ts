import m from 'mithril'
import {
    createTemplate,
    createComponent,
    Component,
    ComponentTemplate,
} from '../../src/index'

const homeTemplate = createTemplate({
    render: ({ link, navigate }) => {
        // Helper that generates good <a> links
        const a = (routeName, params, content) =>
            m(
                'a',
                {
                    href: link(routeName, params),
                    onclick: navigate(routeName, params),
                },
                content,
            )

        return [
            m('h1', 'Aludel demo app'),
            m(
                'span',
                'Open your browser console to see when notable events happen',
            ),
            m('br'),
            m('span', 'Choose demo:'),
            a('Children', {}, 'Children components'),
            a('Subroutes', {}, 'Subroutes'),
            a('Promises', {}, 'Promises'),
        ]
    },
})

export const homeComponent = createComponent(homeTemplate, {}, 'Home')
