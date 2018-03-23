import test from 'ava'
import {
    createTemplate,
    createComponent,
    createRouter,
    createContext,
    RouteMap,
} from '../src/index'

test('createRoute flattens routes', t => {
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
        '/books': {
            name: 'Books',
            component,
            subroutes: {
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

    const router = createRouter(context, routes)
    t.deepEqual(router.flatRoutes, {
        '/': {
            name: 'Home',
            path: '/',
            componentChain: [component],
            actionChain: [undefined],
        },
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

test('Layout route is rendered first in component chain', t => {
    const layoutTemplate = createTemplate({
        render: ({ outlet }) => {
            return `Layout ${outlet}`
        },
    })
    const layoutComponent = createComponent(layoutTemplate, {})

    const homeTemplate = createTemplate({
        render: () => 'Home',
    })
    const homeComponent = createComponent(homeTemplate, {})

    const context = createContext({}, state => {
        console.log(state.$app.instance)
    })

    const routes = {
        '/': {
            name: 'Home',
            component: homeComponent,
        },
    }

    const router = createRouter(context, routes, layoutComponent)

    t.deepEqual(router.flatRoutes, {
        '/': {
            name: 'Home',
            path: '/',
            componentChain: [layoutComponent, homeComponent],
            actionChain: [undefined, undefined]
        }
    })

    router.navigate.Home()
})

test('createRouter throws if two flat routes have the same name or the same path', t => {
    const template = createTemplate({})
    const component = createComponent(template, {})
    const context = createContext({})

    t.throws(() => {
        const routes = {
            '/': { name: 'Home', component },
            '/about': { name: 'Home', component },
        }

        createRouter(context, routes)
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

        createRouter(context, routes)
    })
})

test('createRouter throws if some route does not start with /', t => {
    const template = createTemplate({})
    const component = createComponent(template, {})
    const context = createContext({})

    t.throws(() => {
        const routes = {
            '/': { name: 'Home', component },
            about: { name: 'About', component },
        }

        createRouter(context, routes)
    })
})

test.cb('App state changes when setRoute is called', t => {
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

    const router = createRouter(context, routes)

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
        if (renderCount === 1)
            // On second render we should have instance
            t.is(50, state.$app.instance())
        t.is(50, state.counter)
        renderCount += 1
        // Expect to have 2 renders total
        renderCount === 2 && t.end()
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

    const router = createRouter(context, routes)

    router.setRoute.Home()
})

test.cb('Navigate changes browser state and triggers setRoute', t => {
    const template = createTemplate({
        sockets: ['counter'],
        render: ({ model }) => model.counter,
    })

    const component = createComponent(template, {
        counter: ['counter'],
    })

    let renderCount = 0
    const context = createContext({ counter: 0 }, state => {
        if (renderCount === 1)
            // On second render we should have instance
            t.is(50, state.$app.instance())
        t.is(50, state.counter)
        renderCount += 1
        // Expect to have 2 renders total
        renderCount === 2 && t.end()
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

    const router = createRouter(context, routes)

    router.start()

    router.navigate.Home()
})

test('Link generates correct links to routes', t => {
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

    const router = createRouter(context, routes)

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

test.cb('Link and navigate are available in component render toolkit', t => {
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

    const router = createRouter(context, routes)

    router.start()

    router.navigate.Home()
})
