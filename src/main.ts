import flyd from 'flyd'
import Immutable from 'seamless-immutable'
import Mapper from 'url-mapper'

export type MutableModel = {[key: string]: any}
export type Model = Immutable.ImmutableObject<{[key: string]: any}>
export type UpdateFn = (model: Model) => Model
export type RendererFn = (rootElement: HTMLElement, view: any) => any

export type Component = () => (tools: ViewTools) => any
export type SocketMap = {[key: string]: string[]}
export type ActionMap = Immutable.ImmutableObject<{[key: string]: (...args: any[]) => UpdateFn}>
export type NavigationMap = Immutable.ImmutableObject<{[key: string]: Function}>

export interface ComponentTemplate {
    sockets: string[]
    actions: (tools: ActionTools) => {[key: string]: (...args: any[]) => UpdateFn}
    view: (tools: ViewTools) => any
}

export interface ActionTools {
    paths: SocketMap
}

export interface ViewTools {
    model: Model
    actions: ActionMap
    navigate: NavigationMap
}

export interface Route {
    name: string
    component: Component
    subroutes?: SubRouteMap
    actions?: ((...args: any[]) => UpdateFn)[]
}

export interface SubRoute {
    name: string
    subroutes?: SubRouteMap
    actions?: ((...args: any[]) => UpdateFn)[]
}

export interface FlatRoute {
    name: string
    component: Component
    actions?: ((...args: any[]) => UpdateFn)[]
}

export type RouteMap = {[key: string]: Route}
export type SubRouteMap = {[key: string]: SubRoute}
export type FlatRouteMap = Immutable.ImmutableObject<{[key: string]: FlatRoute}>
export interface Router {
    defaultRoute: string
    defaultRouteParams: {[key: string]: any}
    navigate: {[key: string]: Function}
    routes: FlatRouteMap
}

export const createApp = (initialModel: MutableModel, renderer: RendererFn) => {
    const urlMapper = Mapper()

    const updateStream = flyd.stream<UpdateFn>()

    const applyUpdate = (currentModel: Model, modelUpdate: UpdateFn) => modelUpdate(currentModel)
    const modelStream = flyd.scan<Model, UpdateFn>(applyUpdate, Immutable(initialModel), updateStream)

    let topComponent = () => ({})
    let navigate = Immutable({}) as NavigationMap

    const createComponent = (template: ComponentTemplate, socketMap: SocketMap): Component => {

        const sockets = Immutable(template.sockets)

        const paths: SocketMap = sockets.reduce(
            (acc, socket) => acc.set(socket, socketMap[socket]),
            Immutable(({} as SocketMap))
        )

        const getLocalModel: () => Model = () => sockets.reduce(
            (acc, socket) => acc.set(socket, modelStream().getIn(paths[socket])),
            Immutable({})
        )

        const actionMap = template.actions({paths})

        const modelSync = (localModel: Model) => (globalModel: Model) =>
            sockets.reduce(
                (acc, socket) => {
                    if (paths[socket]) return acc.setIn(paths[socket], localModel[socket])
                    return acc
                },
                globalModel
            )

        const actions: ActionMap = Object
            .keys(actionMap)
            .reduce(
                (acc, name) => acc.set(
                    name,
                    (...args: any[]) => updateStream(modelSync(actionMap[name](...args)(getLocalModel())))
                ),
                (Immutable({}) as ActionMap)
            )


        const initAction = actions['@init']
        if (typeof initAction === 'function') {
            initAction()
        }

        return () => template.view({model: getLocalModel(), navigate, actions})
    }

    const createRouter = (routes: RouteMap): Router => {
        const flattenSubroutes = (component: Component, parentPath: string, subroutes: SubRouteMap): FlatRouteMap => {
            return Object.keys(subroutes).reduce((acc, path) => {
                const fullPath = parentPath + path
                const route = subroutes[path]
                acc = acc.set(fullPath, {name: route.name, component: component, actions: route.actions})

                if (route.subroutes) {
                    return acc.merge(flattenSubroutes(component, fullPath, route.subroutes))
                }

                return acc
            }, Immutable({}) as FlatRouteMap)
        }

        const flatRoutes: FlatRouteMap = Object.keys(routes).reduce((acc, path) => {
            const route = routes[path]
            acc = acc.set(path, {name: route.name, component: route.component, actions: route.actions})

            if (route.subroutes) {
                return acc.merge(flattenSubroutes(route.component, path, route.subroutes))
            }

            return acc
        }, Immutable({}) as FlatRouteMap)

        navigate = Object.keys(flatRoutes).reduce((acc, path) => {
            const route = flatRoutes[path]
            return acc.set(route.name, (params: {[key: string]: any}) => {
                topComponent = route.component
                window.history.pushState({}, '', '#' + urlMapper.stringify(path, params || {}))
                updateStream(model => {
                    return model
                        .setIn(['router', 'current'], route.name)
                        .setIn(['router', 'pages', route.name], params || {})
                })
                route.actions && route.actions.forEach(action => updateStream(action(params || {})))
            })
        }, Immutable({}) as NavigationMap)

        return {
            defaultRoute: 'Main',
            defaultRouteParams: {},
            navigate,
            routes: flatRoutes,
        }
    }

    const start = (rootElement: HTMLElement, router: Router | Component) => {
        if (typeof router === 'function') {
            topComponent = router
        } else {
            const resolveRoute = () => {
                const route = document.location.hash.substring(1)
                const resolved = urlMapper.map(route, router.routes)
                if (resolved) {
                    router.navigate[resolved.match.name](resolved.values)
                    return true
                } else {
                    return false
                }
            }
            window.onpopstate = resolveRoute
            resolveRoute() || router.navigate[router.defaultRoute](router.defaultRouteParams)
        }

        modelStream.map(model => {
            console.log(model)
            renderer(rootElement, topComponent)
        })
    }

    return {
        createComponent,
        createRouter,
        start,
        focus,
    }
}
