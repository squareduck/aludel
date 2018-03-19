import test from 'ava'
import {
    createApp,
    createTemplate,
    createComponent,
    configure,
} from '../src/index'
import { config, configWithError } from './setup'

/*
 * There are two kinds of validation:
 * - Declaration validation: will throw an error before the app starts
 * - Runtime validation: will log error message in console, and add it to
 *   internal message log (Aludel.errors).
 *
 */

test('Validates that all Template sockets got paths in Component', (t) => {
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
    (t) => {
        const template = createTemplate({
            sockets: ['name', 'age'],
            actions: {
                addCity: () => (model) => {
                    return model
                        .set('age', model.age + 1)
                        .set('city', 'Hong Kong')
                },
            },
            render: ({ model, actions }) => {
                // We increment age by 1 in action and check it here.
                // Otherwise we'll get infinite rerendering.
                if (model.age < 22) actions.addCity()
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
        }

        const model = {
            person: {
                name: 'John',
                age: 21,
            },
        }

        const app = createApp(
            renderer,
            model,
            configWithError(t, 'Action', 'addCity', '[city]'),
        )

        app({} as HTMLElement, component)
    },
)

test.todo('Validates that route path is a valid URL')
test.todo('Validates that there are no routes with same name or path')
test.todo('Validates that navigate() has correct params for named route')
test.todo('Validates that link() has correct params for named route')
