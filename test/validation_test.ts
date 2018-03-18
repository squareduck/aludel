import test from 'ava'
import {
    createApp,
    createTemplate,
    createComponent,
    configure,
} from '../src/index'
import { setup } from './setup'

setup()

/*
 * There are two kinds of validation:
 * - Declaration validation: will throw an error before the app starts
 * - Runtime validation: will log error message in console, and add it to
 *   internal message log (Aludel.errors).
 *
 */

test('Validates that all Template sockets got paths in Component', t => {
    const template = createTemplate({
        sockets: ['name', 'age'],
    })

    // All sockets defined
    t.notThrows(() => {
        createComponent(template, {
            name: ['person', 'name'],
            age: ['person', 'age'],
        })
    })

    // Socket 'age' is not defined
    t.throws(() => {
        createComponent(template, {
            name: ['person', 'name'],
        })
    })

    // Unknown socket defined
    t.throws(() => {
        createComponent(template, {
            name: ['person', 'name'],
            age: ['person', 'age'],
            city: ['person', 'city'],
        })
    })
})

test.cb(
    'Validates that local model returned from action has proper shape',
    t => {
        const template = createTemplate({
            sockets: ['name', 'age'],
            actions: {
                addCity: () => model => {
                    return model.set('city', 'Hong Kong')
                },
            },
            render: ({ model, actions }) => {
                actions.addCity()
                return model
            },
        })

        const component = createComponent(template, {
            name: ['person', 'name'],
            age: ['person', 'age'],
        })

        const renderer = (element, instance) => {
            t.deepEqual(instance(), {
                $local: undefined,
                name: 'John',
                age: 21,
            })
            t.end()
        }

        const model = {
            person: {
                name: 'John',
                age: 21,
            },
        }

        const app = createApp(renderer, model)

        // Should throw when action returns local model with extra field
        t.throws(() => {
            app({} as HTMLElement, component)
        })
    },
)

test.todo('Validates that route path is a valid URL')
test.todo('Validates that there are no routes with same name or path')
test.todo('Validates that navigate() has correct params for named route')
test.todo('Validates that link() has correct params for named route')
