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

test('createRouter throws if two flat routes have the same name or the same path', t => {
    const template = createTemplate({})
    const component = createComponent(template, {})
    const context = createContext({})

    t.throws(() => {
        const routes = {
            '/': {name: 'Home', component},
            '/about': {name: 'Home', component},
        }

        createRouter(context, routes)
    })

    t.throws(() => {
        const routes = {
            '/user/profile': {name: 'UserProfile', component},
            '/user': {
                name: 'User',
                component,
                subroutes: {
                    '/profile': {
                        name: 'Profile',
                        component,
                    }
                }
            }
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
            '/': {name: 'Home', component},
            'about': {name: 'About', component},
        }

        createRouter(context, routes)
    })
})

test.cb('App state changes when setRoute is called', t => {
    const homeTemplate = createTemplate({
        render: () => 'Home'
    })
    const homeComponent = createComponent(homeTemplate, {})

    const userTemplate = createTemplate({
        render: () => 'User'
    })
    const userComponent = createComponent(userTemplate, {})

    const postsTemplate = createTemplate({
        render: ({outlet}) => `Posts with ${outlet()}`
    })
    const postsComponent = createComponent(postsTemplate, {})
    const commentsTemplate = createTemplate({
        render: () => 'Comments'
    })
    const commentsComponent = createComponent(commentsTemplate, {})

    const expectedRoute = [
        {path: '/', name: 'Home', params: {}},
        {path: '/user/:id', name: 'User', params: {id: 12}},
        {path: '/posts/comments', name: 'Comments', params: {}},
    ]
    const expectedRender = [
        'Home',
        'User',
        'Posts with Comments'
    ]
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
                    component: commentsComponent
                }
            }
        }
    }

    const router = createRouter(context, routes)

    router.setRoute.Home()
    router.setRoute.User({id: 12})
    router.setRoute.Comments()
})

test.cb('Route actions are executed in context of route component', t => {
    const template = createTemplate({
        sockets: ['counter'],
        render: ({model}) => model.counter
    })

    const component = createComponent(template, {
        counter: ['counter']
    })

    let renderCount = 0
    const context = createContext({counter: 0}, state => {
        if (renderCount === 1) // On second render we should have instance
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
            action: () => (model) => {
                model.counter += 50
                return model
            }
        }
    }

    const router = createRouter(context, routes)

    router.setRoute.Home()
})

test.todo('Navigate changes browser state and triggers setRoute')
test.todo('Link generates correct links to routes')
