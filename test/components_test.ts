import test from 'ava'
import {
    createTemplate,
    createComponent,
    createInstance,
} from '../src/component'
import { createContext } from '../src/context'

test('Instance returns result of Template render function', t => {
    const template = createTemplate({
        sockets: [],
        actions: {},
        render: () => {
            return 'content'
        },
    })

    const component = createComponent(template, {})

    const appContext = createContext()

    const instance = createInstance(appContext, component)

    t.is('content', instance())
})

test('Instance can read local model defined by sockets and paths', t => {
    const template = createTemplate({
        sockets: ['name', 'age'],
        actions: {},
        render: ({ model }) => {
            return model
        },
    })

    const component = createComponent(template, {
        name: ['person', 'name'],
        age: ['person', 'age'],
    })

    const initialState = {
        person: {
            name: 'John',
            age: 21
        }
    }

    const appContext = createContext(initialState)

    const instance = createInstance(appContext, component)

    t.deepEqual({name: 'John', age: 21}, instance())
})
