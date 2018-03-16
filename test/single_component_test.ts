import test from 'ava'
import { createApp, createTemplate, createComponent } from '../src/index'
import { create } from 'domain'

/*
 * In most cases we use callback tests and call t.end() in the renderer.
 */

test.cb('Renders single component app', t => {
    const template = createTemplate({})

    const component = createComponent(template, {})

    const renderer = (element, instance) => {
        t.end()
    }

    const app = createApp(renderer, {})
    app({} as HTMLElement, component)
})

test.cb('Triggers @init action on Component before first render', t => {
    const template = createTemplate({
        sockets: ['initialized'],
        actions: {
            '@init': () => model => {
                return model.set('initialized', true)
            },
        },
        render: ({ model }) => {
            return model.initialized
        },
    })

    const component = createComponent(template, { initialized: ['data'] })

    const renderer = (element, instance) => {
        t.is(instance(), true)
        t.end()
    }

    const app = createApp(renderer, {})
    app({} as HTMLElement, component)
})
