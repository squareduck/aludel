import test from 'ava'
import {
    createTemplate,
    createComponent,
    createContext,
    createApp,
    createRoutedApp,
} from '../src/index'
import { homeComponent } from '../demo/components/home'

test.cb('Single component app renders on global state updates', t => {
    let setName
    const template = createTemplate({
        sockets: ['name'],
        actions: {
            setName: name => model => {
                model.name = name
                return model
            },
        },
        render: ({ model, action }) => {
            // Extract this connected action into scope above on first render
            setName = action.setName
            return model.name
        },
    })

    const component = createComponent(template, {
        name: ['name'],
    })

    let updateCounter = 0
    const expectedNames = ['John', 'Ash', 'Bob', 'Cid']
    const app = createApp({ name: 'John' }, component, instance => {
        t.is(expectedNames[updateCounter], instance())
        updateCounter += 1
        updateCounter === 3 && t.end()
    })

    app()

    // Need to wait for the next tick (promise needs to resolve before rerender)
    setTimeout(() => {
        setName('Ash')
        setName('Bob')
        setName('Cid')
    })
})

test.cb('Can replace $app.instance dynamically from actions', t => {
    const userTemplate = createTemplate({
        render: () => 'User',
    })
    const userComponent = createComponent(userTemplate, {})

    let connectedAction
    const homeTemplate = createTemplate({
        sockets: ['topInstance'],
        actions: {
            replaceInstance: instance => model => {
                model.topInstance = instance
                return model
            },
        },
        render: ({ model, action, create }) => {
            const userInstance = create(userComponent)
            connectedAction = () => action.replaceInstance(userInstance)
            return 'Home'
        },
    })
    const homeComponent = createComponent(homeTemplate, {
        topInstance: ['$app', 'instance'],
    })

    let renderCount = 0
    const app = createApp({}, homeComponent, instance => {
        renderCount += 1
        if (renderCount === 1) {
            t.is('Home', instance())
            connectedAction()
        }
        if (renderCount === 2) {
            t.is('User', instance())
            t.end()
        }
    })

    app()
})

// Home route finding and handling of error when '/' is not defined
test.cb('Routed app renders the root route', t => {
    const homeTemplate = createTemplate({
        render: () => 'Home',
    })
    const homeComponent = createComponent(homeTemplate, {})

    const userTemplate = createTemplate({
        render: () => 'User',
    })
    const userComponent = createComponent(userTemplate, {})

    const badRoutes = {
        '/noRoot': {
            name: 'Home',
            component: homeComponent,
        },
        '/user/:id': {
            name: 'User',
            component: userComponent,
        },
    }

    t.throws(() => {
        const badApp = createRoutedApp({}, { routes: badRoutes }, () => {})
        badApp()
    })

    const routes = {
        '/': {
            name: 'Home',
            component: homeComponent,
        },
        '/user/:id': {
            name: 'User',
            component: userComponent,
        },
    }

    const app = createRoutedApp({}, { routes }, instance => {
        t.is('Home', instance())
        t.end()
    })

    app()
})
