import {createApp, Model, ComponentTemplate, ComponentConfig} from '../src/aludel'
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
        m('div', {onclick: actions.add}, [model.text, outlet()]),
}

const outerConfig: ComponentConfig = {
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

const tasksConfig = {
    template: tasksTemplate,
    paths: {
        'list': ['tasks', 'list'],
        'info': ['tasks', 'info']
    }
}

const taskTemplate: ComponentTemplate = {
    sockets: ['list', 'taskId'],
    actions: {},
    render: ({model, outlet}) => m('div', ['Task start', model.taskId, 'Task end'])
}

const taskConfig = {
    template: taskTemplate,
    paths: {
        'list': ['tasks', 'list'],
        'taskId': ['tasks', 'selectedId']
    }
}

const routes = {
    '/': '/tasks',
    '/tasks': {
        name: 'Tasks', 
        component: tasksConfig, 
        subroutes: {
            '/:id': {
                name: 'Task',
                component: taskConfig,
                action: (params) => (model: Model) => {
                    console.log(params)
                    console.log(model)
                    return model.set('taskId', params.id)
                }
            }
        }

    }
}

start(document.body, outerConfig, routes)
