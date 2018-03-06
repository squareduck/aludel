import {createApp, Model, ComponentTemplate, Component} from '../src/aludel'
import m from 'mithril'

const {createComponent, start} = createApp(
    (rootElement: HTMLElement, component: any) => m.render(rootElement, component()),
    {message: 'Hello', tasks: { list: [{name: 'First task'}] }}
)

const outerTemplate: ComponentTemplate = {
    sockets: ['text'],
    actions: {
        '@init': () => (model) => model.set('text', 'Lol'),
        add: () => (model) => model.set('text', model.text + '!')
    },
    render: ({model, actions, outlet}) =>
        m('div', {onclick: actions.add}, [model.text, outlet()])
}

const outerComponent: Component = {
    template: outerTemplate,
    paths: {
        'text': ['message']
    }
}

const tasksTemplate: ComponentTemplate = {
    sockets: ['list', 'info'],
    actions: {
        '@init': () => (model) => model.set('info', 'Tasks lol')
    },
    render: ({model, outlet}) => m('div', [model.info , outlet(), 'List end'])
}

const tasksComponent = {
    template: tasksTemplate,
    paths: {
        'list': ['tasks', 'list'],
        'info': ['tasks', 'info']
    }
}

const taskTemplate: ComponentTemplate = {
    sockets: ['list', 'taskId'],
    actions: {},
    render: ({model, outlet, navigate}) => m('div', [
        'Task start',
        model.taskId,
        m('button', {onclick: navigate.Tasks()}, 'Go to Tasks'),
        'Task end',
    ])
}

const taskComponent = {
    template: taskTemplate,
    paths: {
        'list': ['tasks', 'list'],
        'taskId': ['tasks', 'selectedId']
    }
}

const routes = {
    '*': '/tasks/404',
    '/': '/tasks',
    '/tasks': {
        name: 'Tasks', 
        component: tasksComponent, 
        subroutes: {
            '/:id': {
                name: 'Task',
                component: taskComponent,
                action: (params: any) => (model: Model) => {
                    return model.set('taskId', params.id)
                }
            }
        }
    }
}

start(document.querySelector('.app') || document.body, outerComponent, routes)
