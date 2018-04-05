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
    const component = createComponent(template, {})
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

test.cb('Router reacts to wildcard route and redirects', t => {
    const template = createTemplate({})
    const component = createComponent(template, {})

    let updateCount = 0
    const expectedRoute = ['Home', 'About', 'Help']
    const context = createContext({}, state => {
        t.is(expectedRoute[updateCount], state.$app.route.name)
        updateCount += 1
        if (updateCount === 3) t.end()
    })

    const routes: RouteMap = {
        '*': '/help',
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
        '/help': {
            name: 'Help',
            component,
        },
        '/info': '/about',
    }

    const router = createRouter(context, { routes })

    router.start()

    router.history.push('/info', {})
    router.history.push('/doesnotexist', {})
})

test.cb('Router inserts layoutComponent into each component chain', t => {
    const layoutTemplate = createTemplate({
        render: ({ outlet }) => {
            return `Layout ${outlet()}`
        },
    })
    const layoutComponent = createComponent(layoutTemplate, {})

    const homeTemplate = createTemplate({
        render: () => 'Home',
    })
    const homeComponent = createComponent(homeTemplate, {})

    const context = createContext({}, state => {
        t.is('Layout Home', state.$app.instance())
        t.end()
    })

    const routes = {
        '/': {
            name: 'Home',
            component: homeComponent,
        },
    }

    const router = createRouter(context, { routes, layoutComponent })

    router.start()

    t.deepEqual(router.flatRoutes, {
        '/': {
            name: 'Home',
            path: '/',
            componentChain: [layoutComponent, homeComponent],
            actionChain: [undefined, undefined],
        },
    })

    router.navigate.Home()
})

test('createRouter() throws if two flat routes have the same name or the same path', t => {
    const template = createTemplate({})
    const component = createComponent(template, {})
    const context = createContext({})

    t.throws(() => {
        const routes = {
            '/': { name: 'Home', component },
            '/about': { name: 'Home', component },
        }

        createRouter(context, { routes })
    })

    t.throws(() => {
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
})

test('createRouter() throws if some route does not start with /', t => {
    const template = createTemplate({})
    const component = createComponent(template, {})
    const context = createContext({})

    t.throws(() => {
        const routes = {
            '/': { name: 'Home', component },
            about: { name: 'About', component },
        }

        createRouter(context, { routes })
    })
})

test.cb('router.setRoute() changes Global State', t => {
    const homeTemplate = createTemplate({
        render: () => 'Home',
    })
    const homeComponent = createComponent(homeTemplate, {})

    const userTemplate = createTemplate({
        render: () => 'User',
    })
    const userComponent = createComponent(userTemplate, {})

    const postsTemplate = createTemplate({
        render: ({ outlet }) => `Posts with ${outlet()}`,
    })
    const postsComponent = createComponent(postsTemplate, {})
    const commentsTemplate = createTemplate({
        render: () => 'Comments',
    })
    const commentsComponent = createComponent(commentsTemplate, {})

    const expectedRoute = [
        { path: '/', name: 'Home', params: {} },
        { path: '/user/:id', name: 'User', params: { id: 12 } },
        { path: '/posts/comments', name: 'Comments', params: {} },
    ]
    const expectedRender = ['Home', 'User', 'Posts with Comments']
    let renderCount = 0
    const context = createContext({}, state => {
        t.deepEqual(expectedRoute[renderCount], state.$app.route)
        t.is(expectedRender[renderCount], state.$app.instance())
        renderCount += 1
        renderCount === 2 && t.end()
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
        '/posts': {
            name: 'Posts',
            component: postsComponent,
            subroutes: {
                '/comments': {
                    name: 'Comments',
                    component: commentsComponent,
                },
            },
        },
    }

    const router = createRouter(context, { routes })

    router.setRoute.Home()
    router.setRoute.User({ id: 12 })
    router.setRoute.Comments()
})

test.cb('Route actions are executed in context of route component', t => {
    const template = createTemplate({
        sockets: ['counter'],
        render: ({ model }) => model.counter,
    })

    const component = createComponent(template, {
        counter: ['counter'],
    })

    let renderCount = 0
    const context = createContext({ counter: 0 }, state => {
        renderCount += 1
        t.is(50, state.counter)
        if (renderCount === 2) {
            t.is(50, state.$app.instance())
            t.end()
        }
    })

    const routes = {
        '/increment/:amount': {
            name: 'Increment',
            component: component,
            action: ({ amount }) => model => {
                model.counter += amount
                return model
            },
        },
    }

    const router = createRouter(context, { routes })

    router.setRoute.Increment({ amount: 50 })
})

test.cb('router.navigate() sets browser URL and triggers setRoute()', t => {
    const template = createTemplate({
        sockets: ['counter'],
        render: ({ model }) => model.counter,
    })

    const component = createComponent(template, {
        counter: ['counter'],
    })

    let renderCount = 0
    const context = createContext({ counter: 0 }, state => {
        renderCount += 1
        t.is(50, state.counter)
        if (renderCount === 2) {
            t.is(50, state.$app.instance())
            t.end()
        }
    })

    const routes = {
        '/': {
            name: 'Home',
            component: component,
            action: () => model => {
                model.counter += 50
                return model
            },
        },
    }

    const router = createRouter(context, { routes })

    router.start()

    router.navigate.Home()
})

test('router.link() generates correct URL to named route', t => {
    const template = createTemplate({})
    const component = createComponent(template, {})
    const context = createContext({})
    const routes = {
        '/': {
            name: 'Home',
            component,
        },
        '/users/:id': {
            name: 'User',
            component,
        },
        '/profile/:id': {
            name: 'Profile',
            component,
            subroutes: {
                '/details/:category': {
                    name: 'Category',
                    component,
                },
            },
        },
    }

    const router = createRouter(context, { routes })

    t.is(router.link.Home(), '/')
    t.is(router.link.User({ id: '15' }), '/users/15')

    t.throws(() => {
        // Not all parameters were supplied
        router.link.User()
    })

    t.is(router.link.Profile({ id: '7' }), '/profile/7')
    t.is(
        router.link.Category({ id: '5', category: '12' }),
        '/profile/5/details/12',
    )
})

test.cb('router.link() and router.navigate() are in template.render()', t => {
    const template = createTemplate({
        render: ({ navigate, link }) => {
            t.is(typeof navigate.Home, 'function')
            t.is(typeof link.Home, 'function')
            t.end()
            return 'Home'
        },
    })

    const component = createComponent(template, {})

    const context = createContext({}, state => {
        state.$app.instance()
    })

    const routes = {
        '/': {
            name: 'Home',
            component: component,
        },
    }

    const router = createRouter(context, { routes })

    router.start()

    router.navigate.Home()
})

test.cb('$init actions of routed components run before first render', t => {
    const parentTemplate = createTemplate({
        sockets: ['parent', 'route'],
        actions: {
            $init: () => model => {
                model.parent = true
                return model
            },
        },
        render: ({ model, outlet }) => {
            return `${model.parent}/${model.route}(${outlet()})`
        },
    })

    const parentComponent = createComponent(parentTemplate, {
        parent: ['parent'],
        route: ['parentRoute'],
    })

    const childTemplate = createTemplate({
        sockets: ['child', 'route'],
        actions: {
            $init: () => model => {
                model.child = true
                return model
            },
        },
        render: ({ model }) => {
            return `${model.child}/${model.route}`
        },
    })

    const childComponent = createComponent(childTemplate, {
        child: ['child'],
        route: ['childRoute'],
    })

    const routes = {
        '/parent': {
            name: 'Parent',
            component: parentComponent,
            action: () => model => {
                model.route = true
                return model
            },
            subroutes: {
                '/child': {
                    name: 'Child',
                    component: childComponent,
                    action: () => model => {
                        model.route = true
                        return model
                    },
                },
            },
        },
    }

    let renderCount = 0
    const context = createContext({}, (state, info) => {
        if (state.$app && state.$app.instance) {
            renderCount += 1
            if (renderCount === 1)
                // Parent $init action is not done
                // Child $init action is not done
                t.is(
                    'undefined/undefined(undefined/true)',
                    state.$app.instance(),
                )
            if (renderCount === 2)
                // Parent $init action is done
                // Child $init action is not done
                t.is('true/undefined(undefined/true)', state.$app.instance())
            if (renderCount === 3) {
                // Both $init actions are done
                t.is('true/undefined(true/true)', state.$app.instance())
                t.end()
            }
        }
    })

    const router = createRouter(context, { routes })

    router.start()

    router.navigate.Child()
})
