import m from 'mithril'
import {
    createTemplate,
    createComponent,
    Component,
    ComponentTemplate
} from '../../src/index'

const homeTemplate = createTemplate({
    render: () => [
        m('div', 'Choose demo:'),
        m('a', {href: '/#/children'}, 'Children components'),
    ]
})

export const homeComponent = createComponent(homeTemplate, {}, 'Home')
