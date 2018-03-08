import m from 'mithril'
import {
    createTemplate,
    createComponent,
    Component,
    ComponentTemplate,
    Model,
} from '../../../src/index'

const mainTemplate = createTemplate({
    sockets: ['message', 'name'],
    actions: {
        updateName: (value) => (model: Model) => model.set('name', value),
    },
    render: ({model, actions, navigate, outlet}) => {
        return [
            m('h1', 'Subroutes'),
            m('span', 'Route action has access to local model of route\'s component'),
            m('span', 'Components have access to "navigate" function and "locations" list'),
            m('span', 'Same component can be reused in different routes'),
            m('span', 'Routes are cached on first visit'),
            m('br'),
            m('span', model.message || 'Default message'),
            m('a', {href: '/#/subroutes?message=Message Updated!'}, 'Click me to update the message'),
            m('input', {
                placeholder: 'Enter name here...',
                value: model.name,
                oninput: m.withAttr('value', actions.updateName)
            }),
            m('button', {onclick: navigate('SubroutePerson', {name: model.name})}, 'Go to ' + model.name + '\'s page'),
            m('button', {onclick: navigate('SubroutePersonOutlet', {name: model.name})}, 'Show ' + model.name + '\'s page here'),
            outlet()
        ]
    }
})

export const mainComponent = createComponent(mainTemplate, {
    message: ['$router', 'current', 'params', 'message'],
    name: ['subroutes', 'name']
}, 'Subroutes Main')
