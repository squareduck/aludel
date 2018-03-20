import { h, patch } from 'ultradom'
import { createTemplate, createComponent, createApp } from '../src/index'

const template = createTemplate({
    sockets: ['counter'],
    actions: {
        increment: () => model => {
            model.counter += 1
            return model
        },
    },
    render: ({ model, action }) => {
        return h('div', {}, [
            h('div', {}, model.counter),
            h('button', { onclick: action.increment }, 'Increment'),
        ])
    },
})

const component = createComponent(template, {
    counter: ['data', 'counter'],
})

const app = createApp({ data: { counter: 50 } }, component, instance => {
    const rootElement = document.querySelector('.app')
    rootElement && patch(instance(), rootElement)
})

app()
