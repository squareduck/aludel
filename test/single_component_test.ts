import test from 'ava'
import { createApp, createTemplate, createComponent } from '../src/index'
import { config } from './setup'

/*
 * In most cases we use callback tests and call t.end() in the renderer.
 */

test.cb('Renders single component app', (t) => {
    const template = createTemplate({})

    const component = createComponent(template, {})

    const renderer = (element, instance) => {
        t.end()
    }

    const app = createApp(renderer, {}, config)
    app({} as HTMLElement, component)
})

test.cb('Triggers @init action on Component before first render', (t) => {
    const template = createTemplate({
        sockets: ['initialized'],
        actions: {
            '@init': () => (model) => {
                return model.set('initialized', true)
            },
        },
        render: ({ model }) => {
            if (model.initialized) return 'OK'
            return 'FAIL'
        },
    })

    const component = createComponent(template, { initialized: ['data'] })

    const renderer = (element, instance) => {
        t.is(instance(), 'OK')
        t.end()
    }

    const app = createApp(renderer, {}, config)
    app({} as HTMLElement, component)
})

test.todo('Components with same template and paths have same signature')
test.todo('Sockets and paths create proper local model')
test.todo('Child components are available in parent render function')
test.todo('Props are passed to child components')
test.todo('Actions update global model')
test.todo('Actions can be async')
test.todo('Actions can represent an array of Update functions')
