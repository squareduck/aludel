import { h } from 'ultradom'
import { createTemplate, createComponent, Component } from '../../src/index'

const h1 = text => h('h1', {}, text)
const h2 = text => h('h2', {}, text)
const h3 = text => h('h3', {}, text)
const p = text => h('p', {}, text)
const code = text => h('code', {}, text)
const br = () => h('br', {})

const aboutTemplate = createTemplate({
    render: ({}) => {
        return h('div', { class: 'page about' }, [
            h('div', { class: 'content' }, [
                h1('What is Aludel'),
                p(
                    'Aludel aims to solve the Model part of Model → View relationship in most Virtual DOM inspired libraries. There is no doubt that "View is a pure function of Model" approach is working. But how exactly this Model should be implemented is up for a debate.',
                ),
                p(
                    'Main design goal for Aludel is to define a strict protocol for reading and updating parts of global state and enforce it across all components.',
                ),
                p(
                    'To achieve it Aludel lets you declare your components ahead of time, and instantiates them automatically as needed during runtime.',
                ),
                p(
                    'You can use any Virtual DOM library (mithril, ultradom, snabbdom, etc). This website and examples below use ultradom.',
                ),
                h1('Components'),
                p(
                    'Components have three stages: Template, Component and Instance. Let us take a closer look at each of them.',
                ),
                h2('Template'),
                p(
                    'Defines component behavior in terms of Sockets, Actions and Render function.',
                ),
                code(`
const template = createTemplate({
    sockets: ['counter'],
    actions: {
        increment: (amount) => (model) => {
            model.counter += amount
            return model
        }
    },
    render: ({model, action}) => {
        return h('div', {}, [
            h('h1', {}, model.counter),
            h('button', {onclick: () => action.increment(1)}, 'Increment')
        ])
    })
})
                    `),
                h3('Sockets'),
                p(
                    'Describe named placeholders for data that will later be populated with some parts of global state. Sockets populated with actual values represent the Local Model of component. It is available inside Actions and in Render function as "model".',
                ),
                h3('Actions'),
                p(
                    'Describe actions available inside Render function. Each action must return a new version of Local Model. It will be synchronized back into global state. Actions can return a Promise of model if needed.',
                ),
                p(
                    'Special action $init can be defined on any template. It will be called only when component is getting instantiated.',
                ),
                p(
                    'If some fields are omitted from returned Local Model they will not be touched during sychronization. This is useful for async actions making sure we do not overwrite parts of Local Model with outdated values.',
                ),
                p(
                    'Under the hood every local model returned from action is treated as promise (using Promise.resolve). That means we defer rendering at least until the next event loop tick. And by default Aludel does not guarantee global state immutability. If your actions mutate same references synchronously, next rendering will happen after all mutations are done. If this behavior is unwanted you should use some immutability library for your actions and/or global state (Immer looks like a good solution).',
                ),
                h3('Render'),
                p(
                    'A View function that should return rendered value based on current Local Model of component. Render function has access to many useful tools, such as "model", "action", and routing tools.',
                ),
                h2('Component'),
                p(
                    'Defines how each socket in Template should find its value in Global State. Having this separate step allows us to have components with identical templates, but ponting into different parts of Global State.',
                ),
                p(
                    'Sometimes components need to store local data. For this purpose components are injected with "$local" path. It is still stored in Global State, but under special path "$local.<component signature>". So in practice it is local per-component state (available both in actions and render function).',
                ),
                code(`
const component = createComponent(template, {
    counter: ['data', 'counter']
})

const differentComponent = createComponent(template, {
    counter: ['backup', 'data', 'counter']
})
                    `),
                h2('Instance'),
                p(
                    'A "connected" version of component. Component by itself is just configuration. We need to give it meaning in context of some Global State. In example below we create new context and instantiate component with it. In most cases there is no need to write this code. Aludel will handle this part automatically when "createApp()" is used.',
                ),
                p(
                    'Instantiated components are cached. Instantiation code will run only once for each component. After that we always use cached version.',
                ),
                code(`
const context = createContext({})
const intance = createInstance(context, component)
instance() // => VNode
                    `),
                h1('State'),
                p(
                    'All Instances are connected to some Global State through Context. Global State is the only dynamic part of the application. And the only way to update Global State is to execute an Action on some Instance.',
                ),
                h1('Context'),
                p(
                    'Context glues components together and makes sure their actions run against the same global state.',
                ),
                p(
                    'It also keeps track of dependencies between components and reruns Component render function only when last action was initiated by dependent Component. Otherwise it just reuses last value returned from render function. We say that two components depend on each other when their paths intersect.',
                ),
                h1('Application'),
                p(
                    'An abstraction over Context to make common tasks like managing instances and rendering into DOM easier.',
                ),
                code(`
const app = createApp({}, myTopComponent, instance => {
    myVDomLibrary.render(instance())
})
                `),
                p(
                    'Create special field $app in Global State and tracks current top level Instance in $app.instance. The content of $app.instance will be passed to "render" callback (see example above). If you want to replace that Instance, just create a new one and set it in some Action.',
                ),
                p(
                    'In an example below if the button is clicked we call Action "replaceInstance" and pass it the new Instance that we created inside of Template renderer with helper "create" function. This Action will update $app.instance and next render is going to use new top Instance.',
                ),
                code(`
const userTemplate = createTemplate({})
const userComponent = createComponent(userTemplate, {})

const homeTemplate = createTemplate({
    sockets: ['topInstance'],
    actions: {
        replaceInstance: (newInstance) => (model) => {
            model.topInstance = newInstance
            return model
        },
    }
    render: ({model, action, create}) => {
        const userInstance = create(userComponent)
        return h(
            'button',
            {onclick: () => action.replaceInstance(userInstance)},
            'Replace'
        )
    }
})

const homeComponent = createComponent(homeTemplate, {
    topInstance: ['$app', 'instance']
})

const app = createApp({}, homeComponent, instance => {
    // patch browser DOM here
})
                `),
                h1('Routing'),
                p(
                    'Aludel provides createRoutedApp function for routed components. You describe routing tree with each node being either a redirect or a named route with attached Component.',
                ),
                p(
                    'Routers can be created manually with createRouter function. Use it if you want to customize application behavior.',
                ),
                h2('Routing is state'),
                p(
                    'When router is started Aludel starts listening to browser location changes and triggering Routing Actions if current URL matches one of the routes. Routing Action changes Global State field $app, and specifically sets $app.instance to instance of route Component, and populates $app.route object with details about current route.',
                ),
                p(
                    'In routed application Instances will have access to "navigate" and "link" functions. Navigate allows us to change the browser URL, and Link returns URL of named route.',
                ),
                h2('Defining routes'),
                p(
                    'Both createRouter() and createRoutedApp() take in RouterConfig object which defines "routes" - routing tree, "mountPoint" - prefix to all routed URLs, "layoutComponent " - top component in any routed Component chain.',
                ),
                p('Redirecting unmatched routes is defined with "*" route.'),
                p(
                    'Components have access to "outlet" in their render function. It will contain the next Instance in routed Component chain. That means - if we have a route with homeComponent and subroute with userComponent, then instances of homeComponent will contain an instance of userComponent in its outlet.',
                ),
                p(
                    'Routes can contain an Action. It will recieve route parameters and is executed in context of route Component. This Action will be triggered every time the route is visited.',
                ),
                p(
                    'In example below we create a Router. Same configuration can be applied to createRoutedApp().',
                ),
                code(`
const layoutTemplate = createTemplate({
    render: ({outlet}) => {
        return h('div', {}, {
            h('h1', {}, 'Layout'),
            outlet()
        })
    }
})
const layoutComponent = createComponent(layoutTemplate, {})

const homeTemplate = createTemplate({
    render: ({outlet, link}) => {
        return h('div', {}, [
            h('h1', {}, 'Home'),
            h('a', {href: link.User({id: 12})}, 'Go to 12th User'),
            outlet()
        ])
    }
})
const homeComponent = createComponent(homeTemplate, {})

const userTemplate = createTemplate({
    sockets: ['userId'],
    render: ({model, navigate}) => {
        return h('div', {}, [
            h('h3', {}, 'User' + model.userId),
            h('button', {onclick: () => navigate.Home()}, 'Go Home')
        ])
    }
})
const userComponent = createComponent(userTemplate, {
    userId: ['user', 'id']
})

const routes = {
    '*': '/home',
    '/user': '/home/user',
    '/home': {
        name: 'Home',
        component: homeComponent,
        subroutes: {
            '/user/:id': {
                name: 'User',
                component: userComponent,
                action: ({id}) => model => {
                    model.userId = id
                    return model
                }
            }
        }
    }
}

const context = createContext({}, state => {
    // Will be called on every Action
})

const router = createRouter(context, {
    routes: routes,
    mountPoint: '/aludelapp',
    layoutComponent: layoutComponent,
})

router.start()
                `),
                h('br'),
            ]),
        ])
    },
})

export const aboutComponent = createComponent(aboutTemplate, {})
