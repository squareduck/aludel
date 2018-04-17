import test from 'ava'
import {
    createTemplate,
    createComponent,
    createRouter,
    createContext,
    RouteMap,
} from '../src/index'

test('createRouter() flattens routes', t => {
    const template = createTemplate({})
    const component = createComponent({ template })
    const context = createContext({})

    const actionFn = () => model => model

    const routes: RouteMap = {
        '/': {
            name: 'Home',
            component,
            subroutes: {
                '/about': {
                    name: 'About',
                    component,
                },
            },
        },
        '*': '/',
        '/best-book': '/books/12',
        '/books': {
            name: 'Books',
            component,
            subroutes: {
                '/best': '/books/12',
                '/preview/:id': {
                    name: 'Preview',
                    component,
                    action: actionFn,
                },
                '/:id': {
                    name: 'Book',
                    component,
                    subroutes: {
                        '/comments': {
                            name: 'Comments',
                            component,
                        },
                    },
                },
            },
        },
    }

    const router = createRouter(context, { routes })
    t.deepEqual(router.flatRoutes, {
        '/': {
            name: 'Home',
            path: '/',
            componentChain: [component],
            actionChain: [undefined],
        },
        '*': '/',
        '/best-book': '/books/12',
        '/books/best': '/books/12',
        '/about': {
            name: 'About',
            path: '/about',
            componentChain: [component, component],
            actionChain: [undefined, undefined],
        },
        '/books': {
            name: 'Books',
            path: '/books',
            componentChain: [component],
            actionChain: [undefined],
        },
        '/books/preview/:id': {
            name: 'Preview',
            path: '/books/preview/:id',
            componentChain: [component, component],
            actionChain: [undefined, actionFn],
        },
        '/books/:id': {
            name: 'Book',
            path: '/books/:id',
            componentChain: [component, component],
            actionChain: [undefined, undefined],
        },
        '/books/:id/comments': {
            name: 'Comments',
            path: '/books/:id/comments',
            componentChain: [component, component, component],
            actionChain: [undefined, undefined, undefined],
        },
    })
})

test('createRouter() throws if two flat routes have the same name or the same path', t => {
    const template = createTemplate({})
    const component = createComponent({ template })
    const context = createContext({})

    const nameErr = t.throws(() => {
        const routes = {
            '/': { name: 'Home', component },
            '/about': { name: 'Home', component },
        }

        createRouter(context, { routes })
    })

    t.is(nameErr.message, 'Route with name Home is already defined')

    const pathErr = t.throws(() => {
        const routes = {
            '/user/profile': { name: 'UserProfile', component },
            '/user': {
                name: 'User',
                component,
                subroutes: {
                    '/profile': {
                        name: 'Profile',
                        component,
                    },
                },
            },
        }

        createRouter(context, { routes })
    })

    t.is(pathErr.message, 'Route with path /user/profile is already defined')
})

test('createRouter() throws if some route does not start with /', t => {
    const template = createTemplate({})
    const component = createComponent({ template })
    const context = createContext({})

    const err = t.throws(() => {
        const routes = {
            '/': { name: 'Home', component },
            about: { name: 'About', component },
        }

        createRouter(context, { routes })
    })

    t.is(err.message, 'Route with name About does not start with slash')
})

test('createRouter() creates navigate action for each route', t => {
    const template = createTemplate({})
    const component = createComponent({ template })
    const routes = {
        '*': '/shop',
        '/shop': {
            name: 'Shop',
            component,
            subroutes: {
                '/item/:id': {
                    name: 'Item',
                    component,
                },
            },
        },
        '/about': {
            name: 'About',
            component,
        },
    }

    const context = createContext({})

    const router = createRouter(context, { routes })

    router.navigate.Shop()
    t.is(router.history.location.pathname, '/shop')

    router.navigate.Item({ id: '12' })
    t.is(router.history.location.pathname, '/shop/item/12')

    router.navigate.About({ filter: 'text' })
    t.is(router.history.location.pathname, '/about')
    t.is(router.history.location.search, '?filter=text')
})

test.cb('createRouter() creates setRoute action for each route', t => {
    const shopTemplate = createTemplate({
        render: ({ outlet }) => `shop ${outlet()}`,
    })
    const shopComponent = createComponent({ template: shopTemplate })

    const itemTemplate = createTemplate({
        render: () => 'item',
    })
    const itemComponent = createComponent({ template: itemTemplate })

    const routes = {
        '/shop': {
            name: 'Shop',
            component: shopComponent,
            subroutes: {
                '/item/:id': {
                    name: 'Item',
                    component: itemComponent,
                },
            },
        },
    }

    const expectedActions = [
        { source: 'Router', name: 'Shop' },
        { source: 'Router', name: 'Item' },
    ]
    const expectedRoutes = [
        { name: 'Shop', path: '/shop', params: {} },
        { name: 'Item', path: '/shop/item/:id', params: { id: 12 } },
    ]
    const expectedRenders = ['shop undefined', 'shop item']
    let updateCount = 0
    const context = createContext({}, (state, action) => {
        updateCount += 1

        t.deepEqual(action, expectedActions[updateCount - 1])
        t.is(state.$app.instance(), expectedRenders[updateCount - 1])
        t.deepEqual(state.$app.route, expectedRoutes[updateCount - 1])

        if (updateCount == 2) t.end()
    })

    const router = createRouter(context, { routes })

    router.setRoute.Shop()
    router.setRoute.Item({ id: 12 })
})

test.cb('createRouter() wires route actions to run inside setRoute', t => {
    const template = createTemplate({
        sockets: ['counter'],
    })
    const component = createComponent({
        template,
        paths: { counter: ['counter'] },
    })

    const expectedActions = [
        { source: 'Router', name: `Home (${component.signature})` },
        { source: 'Router', name: 'Home' },
    ]

    let updateCount = 0
    const context = createContext({ counter: 0 }, (state, action) => {
        updateCount += 1
        t.deepEqual(action, expectedActions[updateCount - 1])
        t.is(state.counter, 5)
        if (updateCount === 2) t.end()
    })

    const routes = {
        '/home': {
            name: 'Home',
            component: component,
            action: params => model => {
                model.counter += params.amount
                return model
            },
        },
    }

    const router = createRouter(context, { routes })
    router.setRoute.Home({ amount: 5 })
})

test('createRouter() creates link() for each route', t => {
    const template = createTemplate({})
    const component = createComponent({ template })

    const context = createContext({})

    const routes = {
        '*': '/shop',
        '/shop': {
            name: 'Shop',
            component,
            subroutes: {
                '/item/:id': {
                    name: 'Item',
                    component,
                },
            },
        },
        '/about': {
            name: 'About',
            component,
        },
    }

    const router = createRouter(context, { routes })

    t.is(router.link.Shop(), '/shop')
    t.is(router.link.Item({ id: '12' }), '/shop/item/12')
    t.is(router.link.About({ filter: 'text' }), '/about?filter=text')
})

test.cb('createRouter() exposes start() which enables history listening', t => {
    const template = createTemplate({})
    const component = createComponent({ template })

    const expectedRoutes = [
        { name: 'Shop', path: '/shop', params: {} },
        { name: 'Item', path: '/shop/item/:id', params: { id: '12' } },
        { name: 'About', path: '/about', params: { filter: 'text' } },
        { name: 'About', path: '/about', params: {} },
        { name: 'Shop', path: '/shop', params: {} },
    ]
    const expectedActions = [
        { source: 'Router', name: 'Shop' },
        { source: 'Router', name: 'Item' },
        { source: 'Router', name: 'About' },
        { source: 'Router', name: 'About' },
        { source: 'Router', name: 'Shop' },
    ]

    let updateCount = 0
    const context = createContext({}, (state, action) => {
        updateCount += 1
        t.deepEqual(state.$app.route, expectedRoutes[updateCount - 1])
        t.deepEqual(action, expectedActions[updateCount - 1])
        if (updateCount === 5) t.end()
    })

    const routes = {
        '*': '/shop',
        '/shop': {
            name: 'Shop',
            component,
            subroutes: {
                '/item/:id': {
                    name: 'Item',
                    component,
                },
            },
        },
        '/info': '/about',
        '/about': {
            name: 'About',
            component,
        },
    }

    const router = createRouter(context, { routes })

    router.start()

    router.history.push('/shop/item/12')
    router.history.push('/about?filter=text')
    router.history.push('/info')
    router.history.push('/doesnotexist')
})

test.cb('createRouter() adds layoutComponent into each component chain', t => {
    const layoutTemplate = createTemplate({
        render: ({ outlet }) => `layout ${outlet()}`,
    })

    const layoutComponent = createComponent({ template: layoutTemplate })

    const homeTempplate = createTemplate({
        render: () => 'home',
    })

    const homeComponent = createComponent({ template: homeTempplate })

    const context = createContext({}, (state, action) => {
        t.deepEqual(action, { source: 'Router', name: 'Home' })
        t.is(state.$app.instance(), 'layout home')
        t.end()
    })

    const routes = {
        '/home': {
            name: 'Home',
            component: homeComponent,
        },
    }

    const router = createRouter(context, { routes, layoutComponent })

    router.setRoute.Home()
})
