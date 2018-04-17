import test from 'ava'
import {
    createTemplate,
    createComponent,
    createContext,
    createApp,
    createRoutedApp,
} from '../src/index'
import { homeComponent } from '../demo/components/home'

test.cb('createApp() returns function which starts update loop', t => {
    const template = createTemplate({
        render: () => 'content',
    })

    const component = createComponent({ template })

    const app = createApp({}, component, (instance, action) => {
        t.deepEqual(action, { source: 'App', name: 'setInstance' })
        t.is(instance(), 'content')
        t.end()
    })

    app()
})

test.cb('createApp() renders instance from $app.instance', t => {
    const secondTemplate = createTemplate({
        render: () => 'second',
    })
    const secondComponent = createComponent({ template: secondTemplate })

    const firstTemplate = createTemplate({
        sockets: ['instance'],
        actions: {
            replaceInstance: instance => model => {
                model.instance = instance
                return model
            },
        },
        render: ({ action, create }) => {
            action.replaceInstance(create(secondComponent))
            return 'first'
        },
    })
    const firstComponent = createComponent({
        template: firstTemplate,
        paths: {
            instance: ['$app', 'instance'],
        },
    })

    const expectedActions = [
        { source: 'App', name: 'setInstance' },
        { source: firstComponent.signature, name: 'replaceInstance' },
    ]

    const expectedRenders = ['first', 'second']

    let updateCount = 0
    const app = createApp({}, firstComponent, (instance, action) => {
        updateCount += 1
        t.deepEqual(action, expectedActions[updateCount - 1])
        t.is(instance(), expectedRenders[updateCount - 1])
        if (updateCount === 2) t.end()
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

    const routedApp = createRoutedApp({}, { routes }, (instance, action) => {
        t.deepEqual(action, { source: 'Router', name: 'Home' })
        t.is(instance(), 'content')
        t.end()
    })

    routedApp()
})
