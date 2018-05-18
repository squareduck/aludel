import test from 'ava'
import {
    createTemplate,
    createComponent,
    createContext,
    createApp,
    createRoutedApp,
} from '../src/index'

test.cb('createApp() returns function which starts update loop', t => {
    const template = createTemplate({
        render: () => 'content',
    })

    const component = createComponent({ template })

    const app = createApp({}, component, (instance, state, action) => {
        t.deepEqual(action, { source: 'App', name: 'setInstance' })
        t.is(instance(), 'content')
        t.end()
    })

    app()
})

test.cb('createApp() renders instance from $app.instance', t => {
    let globalAction

    const secondTemplate = createTemplate({
        render: () => 'second',
    })
    const secondComponent = createComponent({
        name: 'Second',
        template: secondTemplate,
    })

    const firstTemplate = createTemplate({
        sockets: ['instance'],
        actions: {
            replaceInstance: instance => model => {
                model.instance = instance
                return model
            },
        },
        render: ({ action, create }) => {
            globalAction = () => action.replaceInstance(create(secondComponent))
            return 'first'
        },
    })
    const firstComponent = createComponent({
        name: 'First',
        template: firstTemplate,
        paths: {
            instance: ['$app', 'instance'],
        },
    })

    const expectedActions = [
        { source: 'App', name: 'setInstance' },
        { source: 'First (15589495)', name: 'replaceInstance' },
    ]

    const expectedRenders = ['first', 'second']

    let updateCount = 0
    const app = createApp({}, firstComponent, (instance, state, action) => {
        updateCount += 1

        t.is(instance(), expectedRenders[updateCount - 1])
        t.deepEqual(action, expectedActions[updateCount - 1])

        if (updateCount < 2) {
            globalAction()
        } else {
            t.end()
        }
    })

    app()
})

test.cb('createRoutedApp() starts router in addition to creating app', t => {
    const template = createTemplate({
        render: () => 'content',
    })
    const component = createComponent({ template })

    const routes = {
        '*': '/home',
        '/home': {
            name: 'Home',
            component,
        },
    }

    const routedApp = createRoutedApp(
        {},
        { routes },
        (instance, state, action) => {
            t.deepEqual(action, { source: 'Router', name: 'Home' })
            t.is(instance(), 'content')
            t.end()
        },
    )

    routedApp()
})
