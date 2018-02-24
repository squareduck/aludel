import m from 'mithril'
import * as R from 'ramda'
import {
    createApp,
    Component,
    ComponentTemplate,
} from '../src/main'

const renderer = (rootElement: HTMLElement, component: Component) => {
    m.render(rootElement, component())
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
        createComponent(subTemplate, {counter: ['firstCounter', 'value'], message: ['firstCounter', 'message']})(),
        createComponent(subTemplate, {counter: ['secondCounter', 'value'], message: ['secondCounter', 'message']})(),
    ])
}

const homeComponent = app.createComponent(homeTemplate, {title: ['home']})

app.start(document.body, homeComponent)

