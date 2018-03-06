import {createApp, Model, ComponentTemplate, Component} from '../src/index'
import * as m from 'mithril'

const {createComponent, start} = createApp(
    (rootElement: HTMLElement, component: any) => m.render(rootElement, component()),
    {
        tasks: {
            list: {
                1: {id: 1, name: 'First task', done: false},
                2: {id: 2, name: 'Second task', done: true},
            },
            lastId: 2
        }
    }
)

const layoutTemplate: ComponentTemplate = {
    sockets: ['currentView'],
    actions: {},
    render: ({model, actions, navigate, outlet}) => {
        return [
            m('div.navbar', [
                m('div.nav-home', {onclick: navigate.Home()}, 'Home'),
                m('div.nav-tasks', {onclick: navigate.View({view: model.currentView || 'All'})}, 'Tasks'),
                m('div.nav-notes', 'Notes')
			]),
            outlet()
        ]
    }
}

const layoutComponent: Component = {
    template: layoutTemplate,
    paths: {
        currentView: ['tasks', 'currentView']
    }
}

const homeTemplate: ComponentTemplate = {
    sockets: [],
    actions: {
        '@init': () => (model) => model.set('text', 'Welcome!'),
    },
    render: ({model}) => m('div.home', [
        m('p', 'Welcome to Aludel Demo App!'),
        m('p', '<-- Click on Tasks button'),
    ])
}

const homeComponent: Component = {
    template: homeTemplate,
    paths: {}
}

const taskViewsTemplate: ComponentTemplate = {
    sockets: ['views', 'currentView'],
    actions: {
        '@init': () => (model) => model.set('views', {
            'All': (task: any) => true,
            'Completed': (task: any) => task.done,
        })
    },
    render: ({model, outlet, navigate}) => m('div.tasks', [
        m('div.views', [
            m('div.view-list', Object.keys(model.views)
                .map(name => m('div.view', {
                    onclick: navigate.View({view: name}),
                    class: model.currentView === name ? 'active' : ''
                }, name)))
        ]),
        outlet()
    ])
}

const taskViewsComponent = {
    template: taskViewsTemplate,
    paths: {
        'views': ['tasks', 'views'],
        'currentView': ['tasks', 'currentView']
    }
}

const taskListTemplate: ComponentTemplate = {
    sockets: ['list', 'views', 'currentView', 'input', 'lastId'],
    actions: {
        change: (value) => (model: Model) => {
            return model.set('input', value)
        },
        toggleStatus: (id, value) => (model: Model) => {
            console.log(id, value)
            return model.setIn(['list', id, 'done'], value)
        },
        keyup: (event) => (model: Model) => {
            if (event.key === 'Enter') {
                const task = {id: model.lastId + 1, name: model.input, done: false}
                return model
                    .set('input', '')
                    .set('lastId', task.id)
                    .setIn(['list', task.id], task)
            }
            return model
        }
    },
    render: ({model, actions}) => {
        const view = model.views[model.currentView] || (() => true)
        return m('div.task-list', [
            m('input.task-input', {
                value: model.input,
                placeholder: 'Enter new task here...',
                oninput: m.withAttr('value', actions.change),
                onkeyup: actions.keyup,
            }),
            Object.values(model.list).filter(view).map((t: any) => m('div.task-item', [
                m('input[type=checkbox].task-status', {checked: t.done, onclick: m.withAttr('checked', (value) => actions.toggleStatus(t.id, value))}),
                m('div.task-name', t.name),
            ])),
        ])
    }
}

const taskListComponent = {
    template: taskListTemplate,
    paths: {
        input: ['tasks', 'input'],
        lastId: ['tasks', 'lastId'],
        list: ['tasks', 'list'],
        views: ['tasks', 'views'],
        currentView: ['tasks', 'currentView']
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
    '*': '/tasks/All',
    '/': {
        name: 'Home',
        component: homeComponent
    },
    '/tasks': {
        name: 'Tasks', 
        component: taskViewsComponent, 
        subroutes: {
            '/:view': {
                name: 'View',
                component: taskListComponent,
                action: (params: any) => (model: Model) => {
                    return model.set('currentView', params.view)
                }
            }
        }
    }
}

start(document.querySelector('.app') || document.body, layoutComponent, routes)
