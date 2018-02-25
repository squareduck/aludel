import m from 'mithril'
import * as R from 'ramda'
import {
    createApp,
    Component,
    ComponentTemplate,
} from '../src/main'

const renderer = (rootElement: HTMLElement, component: Component) => {
    m.render(rootElement, (component() as any))
}

const app = createApp({
    home: 'Hello, I am Home component!',
    firstCounter: {
        message: 'First counter',
        value: 0,
    },
    secondCounter: {
        message: 'Second counter',
        value: 25,
    }
}, renderer)

const tasksTemplate: ComponentTemplate = {
    sockets: ['taskList', 'selectedTask'],
    actions: () => ({}),
    view: ({foci}) => m('div', `Tasks (selected ${foci.selectedTask()})`)
}

const subTemplate: ComponentTemplate = {
    sockets: ['counter', 'message'],
    actions: ({foci, lenses}) => ({
        increment: () => R.over(lenses.counter, value => value += 1)
    }),
    view: ({foci, actions}) => m('div', {onclick: actions.increment}, foci.message() + ' ' + foci.counter())
}

const homeTemplate: ComponentTemplate = {
    sockets: ['title'],
    actions: ({foci, lenses}) => ({
        change: () => R.over(lenses.title, title => title += '!')
    }),
    view: ({createComponent, foci, actions}) => m('div', {onclick: actions.change}, [
        foci.title(),
        m('div', 'Both counters below are sub components that use the same component template, just different lenses'),
        createComponent(subTemplate, {counter: ['firstCounter', 'value'], message: ['firstCounter', 'message']})(),
        createComponent(subTemplate, {counter: ['secondCounter', 'value'], message: ['secondCounter', 'message']})(),
    ])
}

const homeComponent = app.createComponent(homeTemplate, {title: ['home']})

const tasksComponent = app.createComponent(tasksTemplate, {taskList: ['tasks', 'list'], selectedTask: ['router', 'pages', 'Task', 'id']})

const router = app.createRouter({
    '/': {name: 'Main', component: homeComponent},
    '/tasks': {name: 'Tasks', component: tasksComponent, subroutes: {
        '/:id': {name: 'Task', actions: [(params) => R.set(R.lensPath(['tasks', 'selectedTask']), params.id)]}
    }}
})

router.defaultRoute = 'Task'
router.defaultRouteParams = {id: 3}

app.start(document.body, router)

