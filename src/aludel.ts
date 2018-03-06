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
export type RendererFn = (rootElement: HTMLElement, component: Component) => any
export type RouteRendererFn = (component: Component) => any

export interface ComponentTemplate {
    sockets: string[]
    actions: ActionMap
    render: RenderFn
}

export interface ComponentConfig {
    template: ComponentTemplate
    paths: SocketMap
}

export interface RenderTools {
    actions: ActionMap
    outlet: Component
    model: Model
}

export type Component = () => any
export type RenderFn = (tools: RenderTools) => any
export type Action = (...args: any[]) => (model: Model) => Model
export type RouteAction = (params: {[key: string]: any}) => (model: Model) => Model
export type ActionMap = {[key: string]: Action}
export type SocketMap = {[key: string]: string[]}

export type RouteMap = {[key: string]: Route | string}
export interface Route {
    name: string
    component: ComponentConfig
    action?: RouteAction
    subroutes?: RouteMap
}

export type FlatRouteMap = {[key: string]: FlatRoute}
export interface FlatRouteCache {
    component: Component
}
export interface FlatRoute {
    name: string
    cache?: Component
    components: ComponentConfig[]
    actions: RouteAction[]
}

export const createApp = (
    renderer: RendererFn,
    initialModel: {[key: string]: any},
) => {
    // Step over whole routes tree and create components injected with outlet functions that depend on relevant route changes
    //
    const urlMapper = Mapper()

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

    const createComponent = 
        (template: ComponentTemplate, paths: SocketMap, outlet: Component): Component => {
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

        return () => template.render({model: model(), actions, outlet: outlet})
    }

    const flattenRoutes = (
        initialRoutes: FlatRouteMap,
        root: string,
        actions: RouteAction[], 
        components: ComponentConfig[], 
        routes: RouteMap
    ): FlatRouteMap => 
    {
        const prepareAction = (action: RouteAction, config: ComponentConfig): RouteAction =>
            (params: any) =>
                syncModel(
                    action(params)(localModel(config.template.sockets, config.paths)),
                    config.template.sockets,
                    config.paths
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
            }
            return acc
        }, initialRoutes)
    }

    const createRouting =
        (routes: RouteMap, topConfig: ComponentConfig, render: RouteRendererFn) => {
        const history = createHistory()

        const flatRoutes = flattenRoutes({}, '', [], [], routes)

        let lastRoute: Route
        let lastValues: string

        console.log(flatRoutes)

        const chainComponents =
            (currentConfig: ComponentConfig, restConfigs: ComponentConfig[]): Component => {
            const nextComponent = restConfigs.shift()
            if (nextComponent) {
                return createComponent(
                    currentConfig.template,
                    currentConfig.paths,
                    chainComponents(nextComponent, restConfigs)
                )
            }
            return createComponent(
                currentConfig.template,
                currentConfig.paths,
                () => undefined
            )
        }

        const navigateByPath = (path: string) => {
            const resolved = urlMapper.map(path, flatRoutes)
            if (resolved) {
                const route = resolved.match
                if (!route.cache) {
                    route.cache = chainComponents(topConfig, route.components.slice(0))
                }
                if (route !== lastRoute || lastValues !== JSON.stringify(resolved.values)) {
                    route.actions.forEach(action => updateStream(action(resolved.values)))
                }
                lastRoute = route
                lastValues = JSON.stringify(resolved.values)
                render(route.cache)
            }
        }

        history.listen((location, action) => {
            const path = location.hash.substring(1)
            navigateByPath(path)
        })

        return () => navigateByPath(history.location.hash.substring(1))
    }

    const start = (rootElement: HTMLElement, topConfig: ComponentConfig, routes?: RouteMap) => {
        if (routes) {
            const wrappedRenderer = createRouting(
                routes,
                topConfig,
                (component: Component) => renderer(rootElement, component)
            )
            modelStream.map(model => wrappedRenderer())
        } else {
            const topComponent =
                createComponent(topConfig.template, topConfig.paths, () => undefined)
            modelStream.map(model => renderer(rootElement, topComponent))
        }

    }

    return {
        createComponent,
        start
    }
}
