import { h } from 'ultradom'
import { createTemplate, createComponent, Component } from '../../src/index'

const homeTemplate = createTemplate({
    render: ({}) => {
        return h('div', {class: 'page home'}, [
            h('h1', {}, 'Aludel'),
            h('h3', {}, 'Web framework with components living in subjective realities.')
        ])
    }
})

export const homeComponent = createComponent(homeTemplate, {})
