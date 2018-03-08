import m from 'mithril'
import {
    createTemplate,
    createComponent,
    Component,
    ComponentTemplate,
    Model,
} from '../../../src/index'

const personTemplate = createTemplate({
    sockets: ['person'],
    render: ({model, actions, navigate}) => {
        return [
            m('h1', model.person + '\'s page'),
            m('button', {onclick: navigate('Subroutes')}, 'Close')
        ]
    }
})

export const personComponent = createComponent(personTemplate, {
    person: ['subroutes', 'personName']
}, 'Subroutes Person')
