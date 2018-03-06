//
// # Notes
//
// Route can create actions with the same local model as its component
//
//
// const tasksTemplate = {
//     sockets: ['views'],
//     actions: () => ({
//         '@init': () => (model) => {
//             if (!model.views) {
//                 return model.set('views', {1: {name: 'All', rule: 'all'}})
//             }
//             return model
//         }
//     }),
//     render: ({outlet}) => m('div', outlet())

// const tasksComponent = {
//     template: tasksTemplate,
//     sockets: {
//         'views': ['tasks', 'views']
//     }
// }
//
//
// const router = {
//     '/': '/tasks',
//     '/tasks': {name: 'Tasks', component: tasksComponent, subroutes: {
//         '/views/:id': {name: 'TaskView', component: taskView, subroutes: {
//             '/task/:id': {name: 'TaskInfo', component: taskInfo}
//         }}
//     }}
// }

// createApp(layoutComponent, router)
//
import flyd from 'flyd'
import Immutable from 'seamless-immutable'
import Mapper from 'url-mapper'
import createHistory from 'history/createBrowserHistory'

export type Model = Immutable.ImmutableObject<{[key: string]: any}>
export type UpdateFn = (model: Model) => Model
export type RendererFn = (rootElement: HTMLElement, instance: ComponentInstance) => any
export type RouteRendererFn = (instance: ComponentInstance) => any

export interface ComponentTemplate {
    sockets: string[]
    actions: ActionMap
    render: RenderFn
}

export interface Component {
    template: ComponentTemplate
    paths: SocketMap
}

export interface RenderTools {
    actions: ActionMap
    outlet: ComponentInstance
    model: Model
    navigate?: Navigation
}

export type ComponentInstance = () => any
export type RenderFn = (tools: RenderTools) => any
export type Action = (...args: any[]) => (model: Model) => Model
export type RouteAction = (params: {[key: string]: any}) => (model: Model) => Model
export type ActionMap = {[key: string]: Action}
export type SocketMap = {[key: string]: string[]}

export type RouteMap = {[key: string]: Route | string}
export interface Route {
    name: string
    component: Component
    action?: RouteAction
    subroutes?: RouteMap
}

export type Navigation = {[key: string]: Function}

export type FlatRouteMap = {[key: string]: FlatRoute | string}
export interface FlatRouteCache {
    instance: ComponentInstance
}
export interface FlatRoute {
    name: string
    cache?: ComponentInstance
    components: Component[]
    actions: RouteAction[]
}

export const createApp = (renderer: RendererFn, initialModel: {[key: string]: any}) => {
    window.Aludel = {}

    const urlMapper = Mapper({query: true})

    const updateStream = flyd.stream<UpdateFn>()

    const applyUpdate = 
        (currentModel: Model, modelUpdate: UpdateFn) => modelUpdate(currentModel)

    const modelStream =
        flyd.scan<Model, UpdateFn>(applyUpdate, Immutable(initialModel), updateStream)

    const localModel = (sockets: string[], paths: SocketMap) =>
        sockets.reduce(
            (acc, socket) => acc.set(socket, modelStream().getIn(paths[socket])),
            Immutable({}) as Model
        )

    const syncModel = (local: Model, sockets: string[], paths: SocketMap) => (global: Model) =>
        sockets.reduce(
            (acc, socket) => {
                if (paths[socket]) return acc.setIn(paths[socket], local[socket])
                return acc
            },
            global
        )

    const createComponent = (
        template: ComponentTemplate,
        paths: SocketMap,
        outlet: ComponentInstance,
        navigate?: Navigation,
    ): ComponentInstance => {
        const model = () => localModel(template.sockets, paths)

        // TODO: Make sure all sockets have defined paths

        const actions = Object
            .keys(template.actions)
            .reduce(
                (acc, action) => {
                    const postActionModel = (...args: any[]) =>
                        template.actions[action](...args)(localModel(template.sockets, paths))
                    acc[action] = (...args: any[]) => 
                        updateStream(syncModel(
                            postActionModel(...args),
                            template.sockets, 
                            paths)
                        )
                    return acc
                },
                {} as any
            )

        if (actions['@init']) actions['@init']()

        return () => template.render({model: model(), actions, outlet: outlet, navigate})
    }

    const flattenRoutes = (
        initialRoutes: FlatRouteMap,
        root: string,
        actions: RouteAction[], 
        components: Component[], 
        routes: RouteMap
    ): FlatRouteMap => 
    {
        const prepareAction = (action: RouteAction, component: Component): RouteAction =>
            (params: any) =>
                syncModel(
                    action(params)(localModel(component.template.sockets, component.paths)),
                    component.template.sockets,
                    component.paths
                )

        return Object.keys(routes).reduce((acc, path) => {
            const route = routes[path]
            if (typeof route !== 'string') {
                route.action && actions.push(prepareAction(route.action, route.component))
                components.push(route.component)
                acc[root + path] = {
                    name: route.name,
                    components: components,
                    actions: actions
                }
                if (route.subroutes) flattenRoutes(
                    acc,
                    root + path,
                    actions.slice(0),
                    components.slice(0),
                    route.subroutes
                )
            } else {
                acc[root + path] = (route as string)
            }
            return acc
        }, initialRoutes)
    }

    const createRouting = (
        routes: RouteMap,
        topComponent: Component,
        render: RouteRendererFn) =>
    {
        const history = createHistory()

        const flatRoutes = flattenRoutes({}, '', [], [], routes)

        const navigate = Object.keys(flatRoutes).reduce((acc: Navigation, path) => {
            const route = flatRoutes[path]
            if (typeof route !== 'string') {
                acc[route.name] =
                    (params:any) =>
                        () => history.push('#' + urlMapper.stringify(path, params || {}), {})
            }
            return acc
        }, {})

        let lastRoute: Route
        let lastValues: string

        const chainComponents =
            (currentConfig: Component, restConfigs: Component[]): ComponentInstance => {
            const nextComponent = restConfigs.shift()
            if (nextComponent) {
                return createComponent(
                    currentConfig.template,
                    currentConfig.paths,
                    chainComponents(nextComponent, restConfigs),
                    navigate
                )
            }
            return createComponent(
                currentConfig.template,
                currentConfig.paths,
                () => undefined,
                navigate
            )
        }

        const updateRouterModel = (route: FlatRoute, params: any) => {
            updateStream((model) =>
                model.setIn(['$router', 'currentRoute'], {
                    name: route.name,
                    params: params,
                })
            )
        }

        const navigateByPath = (path: string) => {
            const resolved = urlMapper.map(path, flatRoutes)
            if (resolved) {
                const route = resolved.match
                if (typeof route === 'string') {
                    history.push('#' + route, {})
                } else {
                    if (!route.cache) {
                        route.cache = chainComponents(topComponent, route.components.slice(0))
                    }
                    if (
                        (lastRoute && route.name !== lastRoute.name) 
                        || lastValues !== JSON.stringify(resolved.values)
                    ) {
                        lastRoute = route
                        lastValues = JSON.stringify(resolved.values)
                        updateRouterModel(route, resolved.values)
                        route.actions.forEach(
                            (action: RouteAction) => updateStream(action(resolved.values))
                        )
                        console.log('Rendering route', path)
                        render(route.cache)
                    }

                }
            } else {
                history.push('#' + flatRoutes['*'], {})
            }
        }

        history.listen((location, action) => {
            const path = location.hash.substring(1)
            navigateByPath(path)
        })

        history.push('/#/', {})

        return () => navigateByPath(history.location.hash.substring(1))
    }

    const start = (rootElement: HTMLElement, topComponent: Component, routes?: RouteMap) => {
        if (routes) {
            const wrappedRenderer = createRouting(
                routes,
                topComponent,
                (instance: ComponentInstance) => renderer(rootElement, instance)
            )
            modelStream.map(model => {
                window.Aludel.model = model
                wrappedRenderer()
            })
        } else {
            const topInstance =
                createComponent(topComponent.template, topComponent.paths, () => undefined)
            modelStream.map(model => renderer(rootElement, topInstance))
        }

    }

    return {
        createComponent,
        start
    }
}
