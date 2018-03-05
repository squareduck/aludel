import {createApp, Model, ComponentTemplate} from '../src/aludel'
import m from 'mithril'

const {createComponent, start} = createApp(
    (rootElement: HTMLElement, component: any) => m.render(rootElement, component()),
    {message: 'Hello'}
)

const homeTemplate: ComponentTemplate = {
    sockets: ['text'],
    actions: {
        '@init': () => (model) => model.set('text', 'Init'),
        add: () => (model) => model.set('text', model.text + '!')
    },
    render: ({model, actions}) => m('div', {onclick: actions.add}, model.text),
}

const homeComponent = createComponent(homeTemplate, {'text': ['message']})

start(document.body, homeComponent)
