import * as flyd from 'flyd'
import * as Immutable from 'seamless-immutable'
import * as Mapper from 'url-mapper'
import * as hash from 'object-hash'
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
    signature: string
    template: ComponentTemplate
    paths: SocketMap
}

export interface RenderTools {
    actions: ActionMap
    outlet: ComponentInstance
    model: Model
    create: (component: Component) => ComponentInstance
    locations: Locations
    navigate: Function
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

export const createComponent = (template: ComponentTemplate, paths: SocketMap): Component => {
    return {
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

    const syncModel = (local: Model, sockets: string[], paths: SocketMap) => (global: Model) =>
        sockets.reduce(
            (acc, socket) => {
                if (paths[socket]) return acc.setIn(paths[socket], local[socket])
                return acc
            },
            global
        )

    const instantiateComponent = (
        template: ComponentTemplate,
        paths: SocketMap,
        outlet: ComponentInstance,
        routerConfig: RouterConfig,
    ): ComponentInstance => {
        if (!routerConfig.navigate) routerConfig.navigate = () => undefined
        if (!routerConfig.locations) routerConfig.locations = {}

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

        return () => {
            const componentCache: {[key: string]: ComponentInstance} = {}
            const create = (component: Component) => {
                if (!componentCache[component.signature])
                    componentCache[component.signature] = instantiateComponent(
                        component.template,
                        component.paths,
                        () => undefined,
                        routerConfig
                    )

                return componentCache[component.signature]
            }

            return template.render({
                model: model(),
                actions,
                outlet,
                navigate: routerConfig.navigate,
                locations: routerConfig.locations,
                create,
            })
        }
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
            (currentConfig: Component, restConfigs: Component[]): ComponentInstance => {
            const nextComponent = restConfigs.shift()
            if (nextComponent) {
                return instantiateComponent(
                    currentConfig.template,
                    currentConfig.paths,
                    chainComponents(nextComponent, restConfigs),
                    {locations, navigate}
                )
            }
            return instantiateComponent(
                currentConfig.template,
                currentConfig.paths,
                () => undefined,
                {locations, navigate}
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

        const navigateByPath = (path: string, force?: boolean) => {
            const resolved = urlMapper.map(path, flatRoutes)
            if (resolved) {
                const route = resolved.match
                if (typeof route === 'string') {
                    history.push('#' + route, {})
                } else {
                    const valuesString = JSON.stringify(resolved.values)
                    if (!route.cache) {
                        route.cache = chainComponents(topComponent, route.components.slice(0))
                    }
                    if (
                        (lastRoute && route.name !== lastRoute.name) 
                        || lastValues !== valuesString
                    ) {
                        lastRoute = route
                        lastValues = valuesString
                        updateRouterModel(route, resolved.values)
                        route.actions.forEach(
                            (action: RouteAction) => updateStream(action(resolved.values))
                        )
                        console.log('Rendering route', path)
                        render(route.cache)
                    } else if (force) {
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

        return (force: boolean) => navigateByPath(history.location.hash.substring(1), force)
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
                wrappedRenderer(true)
            })
        } else {
            const topInstance =
                instantiateComponent(topComponent.template, topComponent.paths, () => undefined)
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
