import flyd from 'flyd'
import Immutable from 'seamless-immutable'
import Mapper from 'url-mapper'
import hash from 'object-hash'
import createHistory from 'history/createBrowserHistory'

export type Model = Immutable.ImmutableObject<{[key: string]: any}>
export type UpdateFn = (model: Model) => Model
export type RendererFn = (rootElement: HTMLElement, instance: ComponentInstance) => any
export type RouteRendererFn = (instance: ComponentInstance) => any

export interface ComponentTemplate {
    sockets: string[]
    actions: ActionMap
    children: {[key: string]: Component}
    render: RenderFn
}

export interface Component {
    name?: string
    signature: string
    template: ComponentTemplate
    paths: SocketMap
}

export type Props = {[key: string]: any}

export interface RenderTools {
    actions: ActionMap
    outlet: ComponentInstance
    model: Model
    child: {[key: string]: ComponentInstance}
    props: Props
    locations: Locations
    navigate: Function
}

export type ComponentInstance = (props: Props) => any
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

export type Locations = {[key: string]: Function}
export interface RouterConfig {
    navigate: Function
    locations: Locations
}

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

const urlMapper = Mapper({query: true})

export const createTemplate = (template: {[key: string]: any}) => {
    const defaults = {
        sockets: [],
        actions: {},
        children: {},
        render: () => {},
    }

    if (template.sockets) defaults.sockets = template.sockets
    if (template.actions) defaults.actions = template.actions
    if (template.children) defaults.children = template.children
    if (template.render) defaults.render = template.render

    return defaults
}

export const createComponent =
    (template: ComponentTemplate, paths: SocketMap, name?: string): Component => {
    return {
        name: name,
        signature: hash({template, paths}),
        template,
        paths,
    }
}

export const createApp = (renderer: RendererFn, initialModel: {[key: string]: any}) => {
    window.Aludel = {}

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

    const syncModel = (local: Model, sockets: string[], paths: SocketMap) =>
        (global: Model) =>
            sockets.reduce(
                (acc, socket) => {
                    if (paths[socket]) return acc.setIn(paths[socket], local[socket])
                    return acc
                },
                global
            )

    const instantiateComponent = (
        {name, template, paths, signature}: Component,
        outlet: ComponentInstance,
        routerConfig: RouterConfig,
    ): ComponentInstance => {
        // TODO: Make sure all sockets have defined paths
        
        console.log('CREATE: Component', name || signature)
        const actions =
            Object.keys(template.actions)
            .reduce(
                (acc, action) => {
                    const postActionModel = (...args: any[]) =>
                        template.actions[action](...args)(localModel(template.sockets, paths))
                    acc[action] = (...args: any[]) => {
                        console.log(`UPDATE: ${name || signature} @ ${action}`)
                        updateStream(syncModel(
                            postActionModel(...args),
                            template.sockets, 
                            paths)
                        )
                    }
                    return acc
                },
                {} as any
            )

        const children =
            Object.keys(template.children)
            .reduce(
                (acc, name) => {
                    const child = template.children[name]
                    acc[name] = instantiateComponent(
                        child,
                        () => {},
                        routerConfig,
                    )
                    return acc
                },
                {} as any
            )

        const model = () => localModel(template.sockets, paths)

        return (props: Props) => template.render({
                model: model(),
                actions,
                outlet,
                navigate: routerConfig.navigate,
                locations: routerConfig.locations,
                child: children,
                props: props,
            })
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
            const localComponents = components.slice(0)
            if (typeof route !== 'string') {
                route.action && actions.push(prepareAction(route.action, route.component))
                localComponents.push(route.component)
                acc[root + path] = {
                    name: route.name,
                    components: localComponents,
                    actions: actions
                }
                if (route.subroutes) flattenRoutes(
                    acc,
                    root + path,
                    actions.slice(0),
                    localComponents,
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

        window.Aludel.routes = flatRoutes

        const locations = Object.keys(flatRoutes).reduce((acc: Locations, path) => {
            const route = flatRoutes[path]
            if (typeof route !== 'string') {
                acc[route.name] =
                    (params:any) =>
                        () => history.push('#' + urlMapper.stringify(path, params || {}), {})
            }
            return acc
        }, {})

        const navigate = (name: string, params: {[key: string]: any}) => {
            const route = locations[name]
            if (route) return route(params)
        }

        window.Aludel.navigate = navigate

        let lastRoute: Route
        let lastValues: string

        const chainComponents =
            (current: Component, rest: Component[]): ComponentInstance => {
            const nextComponent = rest.shift()
            if (nextComponent) {
                return instantiateComponent(
                    current,
                    chainComponents(nextComponent, rest),
                    {locations, navigate}
                )
            }
            return instantiateComponent(
                current,
                () => undefined,
                {locations, navigate}
            )
        }

        const updateRouterModel = (route: FlatRoute, params: any) => {
            console.log('UPDATE: Router model')
            updateStream((model) =>
                model.setIn(['$router', 'current'], {
                    name: route.name,
                    params: params,
                })
            )
        }

        const routeCache = {}

        const navigateByPath = (path: string, force?: boolean) => {
            const resolved = urlMapper.map(path, flatRoutes)
            if (resolved) {
                const route = resolved.match
                if (typeof route === 'string') {
                    history.push('#' + route, {})
                } else {
                    const valuesString = JSON.stringify(resolved.values)
                    let cachedRoute = routeCache[route.name]
                    if (!cachedRoute) {
                        console.log(' CACHE: Route', route.name)
                        routeCache[route.name] =
                            chainComponents(topComponent, route.components.slice(0))
                    }
                    cachedRoute = routeCache[route.name]
                    if (
                        (lastRoute && route.name !== lastRoute.name) 
                        || lastValues !== valuesString
                    ) {
                        lastRoute = route
                        lastValues = valuesString
                        updateRouterModel(route, resolved.values)
                        route.actions.forEach(
                            (action: RouteAction) => {
                                console.log('UPDATE: Route action for', route.name)
                                updateStream(action(resolved.values))
                            }
                        )
                        console.log(`RENDER: ${route.name} (${path})`)
                        render(cachedRoute)
                    } else if (force) {
                        console.log('RENDER: --')
                        render(cachedRoute)
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

        return (force: boolean) => navigateByPath(history.location.hash.substring(1), force)
    }

    const start = (rootElement: HTMLElement, topComponent: Component, routes?: RouteMap) => {
        if (routes) {
            const routingRenderer = createRouting(
                routes,
                topComponent,
                (instance: ComponentInstance) => renderer(rootElement, instance)
            )
            modelStream.map(model => {
                window.Aludel.model = model
                routingRenderer(true)
            })
        } else {
            const topInstance =
                instantiateComponent(
                    topComponent,
                    () => undefined,
                    {navigate: () => {}, locations: {}}
                )
            modelStream.map(model => {
                window.Aludel.model = model
                renderer(rootElement, topInstance)
            })
        }

    }

    return {
        start
    }
}
