import flyd from 'flyd'
import Immutable from 'seamless-immutable'
import Mapper from 'url-mapper'
import hash from 'object-hash'
import createHistory from 'history/createBrowserHistory'
import {
    applyConfig,
    AppConfig,
    setGlobal,
    log,
    validateComponentPaths,
    checkLocalModel,
} from './debug'

export { applyConfig as configure } from './debug'

/*
 * App
 */

export type StartFn = (
    rootElement: HTMLElement,
    topComponent: Component,
    routerConfig?: RouterConfig,
) => void

/*
 * Renderer
 */
export type RendererFn = (
    rootElement: HTMLElement,
    instance: ComponentInstance,
) => any
export type RouteRendererFn = (instance: ComponentInstance) => any

/*
 * Model
 */

export type Model = Immutable.ImmutableObject<{ [key: string]: any }>
export type UpdateFn = (model: Model) => Model

/*
 * Components
 */

export type Action = (
    ...args: any[]
) => (UpdateFn | Promise<UpdateFn>) | (UpdateFn | Promise<UpdateFn>)[]
export type ActionMap = { [key: string]: Action }

// Wrapper around Action that will call the action with local model and sync
// results back into global state.
//
// All of the above will be wrapped into UpdateFn and passed to UpdateStream
export type ConnectedAction = (...args: any[]) => void

export type RenderFn = (tools: RenderTools) => any

export type ComponentTemplate = {
    sockets: string[] // socket name
    actions: ActionMap
    children: { [key: string]: Component }
    render: RenderFn
}

export type SocketMap = { [key: string]: string[] }

export type Component = {
    name?: string
    signature: string // unique hash of component template + paths
    template: ComponentTemplate
    paths: SocketMap
}

export type ComponentInstance = (props?: Props) => any
export type Props = { [key: string]: any }

export type RenderTools = {
    actions: ActionMap
    outlet: ComponentInstance
    model: Model
    child: { [key: string]: ComponentInstance }
    props: Props
    locations: Locations
    navigate: NavigateFn
    link: LinkFn
}

/*
 * Routing
 */

// Routing configuration passed to app.start()
export type RouterConfig = {
    routes: RouteMap
    rootPath?: string
    defaultPath?: string
}

// Routing tree that will be passed to the app
export type RouteMap = { [key: string]: Route | string }
export type Route = {
    name: string
    component: Component
    action?: Action
    subroutes?: RouteMap
}

// Route converted from initial routing tree with all subroutes flattened
export type FlatRoute = {
    path: string
    name: string
    cache?: ComponentInstance
    components: Component[]
    connectedActions: Immutable.ImmutableArray<ConnectedAction>
}

export type FlatRouteMap = { [key: string]: FlatRoute | string }
export type FlatRouteCache = {
    instance: ComponentInstance
}

export type Locations = { [key: string]: Function }
export type LinkFn = (name: string, params: any) => string
export type NavigateFn = (name: string, params: any) => void
export type RouterTools = {
    link: LinkFn
    navigate: NavigateFn
    locations: Locations
}

/*
 * Create complete template from incomplete set of fields.
 *
 * A valid template must contain all fields, so we fill in missing ones
 * with default values.
 *
 */
export const createTemplate = (template: {
    [key: string]: any
}): ComponentTemplate => {
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

/*
 * Create component from template and path.
 *
 * This function automatically generates a unique signature for component.
 * A new socket named '$local' is added, and a new path for this socket is
 * created leading to ['$local', <signature>]. This allows each component to
 * have 'local' state.
 *
 */
export const createComponent = (
    template: ComponentTemplate,
    paths: SocketMap,
    name?: string,
): Component => {
    // Generate component-unique signature
    const signature = hash({ template, paths })

    // Validation
    validateComponentPaths(name || signature, template.sockets, paths)

    // Add $local socket and path to template
    paths['$local'] = ['$local', signature]
    const localSockets = template.sockets.slice(0)
    localSockets.push('$local')
    const localTemplate = Object.assign({}, template)
    localTemplate.sockets = localSockets

    return {
        name: name,
        signature,
        template: localTemplate,
        paths,
    }
}

/*
 * Create Aludel application.
 *
 * This function sets up all the internal plumbing.
 *
 * Returns the 'start' function that actually starts the app.
 *
 */
export const createApp = (
    renderer: RendererFn,
    initialModel: { [key: string]: any },
    config: Partial<AppConfig> = {},
): StartFn => {
    // App configuration
    const appConfig = applyConfig(config)

    // Stream of update functions (actions)
    const updateStream = flyd.stream<UpdateFn>()

    const applyUpdate = (currentModel: Model, modelUpdate: UpdateFn) =>
        modelUpdate(currentModel)

    // Stream that is carrying global state. On each new action in update
    // stream we derive a new value for global state.
    const modelStream = flyd.scan<Model, UpdateFn>(
        applyUpdate,
        Immutable(initialModel),
        updateStream,
    )

    /*
     * Derive a local model from sockets and paths.
     * We still use sockets here because component template should be definite
     * source of top-level fields in local model. Paths object can contain
     * arbitrary amount of fields. We are concerned only with fields that also
     * appear in sockets.
     */
    const localModel = (sockets: string[], paths: SocketMap) =>
        sockets.reduce(
            (acc, socket) =>
                acc.set(socket, modelStream().getIn(paths[socket])),
            Immutable({}) as Model,
        )

    /*
     * Sync changes to local model back into global state.
     * Same concerns as described above apply here. We only care about sockets.
     */
    const syncModel = (local: Model, sockets: string[], paths: SocketMap) => (
        global: Model,
    ) => {
        return sockets.reduce((acc, socket) => {
            if (paths[socket]) return acc.setIn(paths[socket], local[socket])
            return acc
        }, global)
    }

    /*
     * Link raw action with updateStream of current app.
     * 
     * Handle promises if needed.
     *
     */
    const connectAction = (
        componentName: string,
        actionName: string,
        action: Action,
        sockets: string[],
        paths: SocketMap,
    ): ConnectedAction => (...args) => {
        let updateCollection = action(...args)
        if (!Array.isArray(updateCollection)) {
            updateCollection = [updateCollection]
        }
        updateCollection.forEach((update) =>
            Promise.resolve(update)
                .then((resolvedUpdate) =>
                    resolvedUpdate(localModel(sockets, paths)),
                )
                .then((newModel) => {
                    checkLocalModel(
                        appConfig,
                        componentName,
                        actionName,
                        newModel,
                        sockets,
                    )
                    return updateStream(syncModel(newModel, sockets, paths))
                }),
        )
    }

    /*
     * Create a "renderer-ready" function from component
     */
    const instantiateComponent = (
        { name, template, paths, signature }: Component,
        outlet: ComponentInstance,
        routerConfig: RouterTools,
    ): ComponentInstance => {
        log(appConfig, 'CREATE: Component instance', name || signature)
        /*
         * Actions should be executed against local model and their
         * result should be synchronised back into global state.
         */
        const actions = Object.keys(template.actions).reduce(
            (acc, action) => {
                acc[action] = connectAction(
                    name || signature,
                    action,
                    template.actions[action],
                    template.sockets,
                    paths,
                )
                return acc
            },
            {} as any,
        )

        if (actions['@init']) {
            log(appConfig, 'UPDATE: Init action for', name || signature)
            actions['@init']()
        }

        /*
         * Children components defined in template should inherit routing
         * configuration from parent (since they are created outside of
         * routing tree). They can't have outlets.
         */
        const children = Object.keys(template.children).reduce(
            (acc, name) => {
                const child = template.children[name]
                acc[name] = instantiateComponent(child, () => {}, routerConfig)
                return acc
            },
            {} as any,
        )

        /*
         * Renderer function should see only local model derived from global
         * state. Current version of local model should be calculated on each
         * rerender.
         */
        const model = () => localModel(template.sockets, paths)

        /*
         * Render function.
         *
         * Can take props from parent component. Those are read only values,
         * useful for passing context to child components.
         */
        return (props: Props) =>
            template.render({
                model: model(),
                actions,
                outlet,
                navigate: routerConfig.navigate,
                locations: routerConfig.locations,
                link: routerConfig.link,
                child: children,
                props: props || {},
            })
    }

    /*
     * Take initial (possibly) nested routing object and flatten it.
     * Create separate route for each subroute path.
     */
    const flattenRoutes = (
        initialRoutes: FlatRouteMap,
        root: string,
        connectedActions: Immutable.ImmutableArray<ConnectedAction>,
        components: Component[],
        routes: RouteMap,
    ): FlatRouteMap => {
        return Object.keys(routes).reduce((acc, path) => {
            const route = routes[path]
            const localComponents = components.slice(0)
            if (typeof route !== 'string') {
                let currentConnectedActions
                if (route.action) {
                    currentConnectedActions = connectedActions.concat([
                        connectAction(
                            `${route.component.name ||
                                route.component.signature} on Route "${
                                route.name
                            }"`,
                            'Route action',
                            route.action,
                            route.component.template.sockets,
                            route.component.paths,
                        ),
                    ])
                } else {
                    currentConnectedActions = connectedActions
                }
                localComponents.push(route.component)
                acc[root + path] = {
                    path: root + path,
                    name: route.name,
                    components: localComponents,
                    connectedActions: currentConnectedActions,
                }
                if (route.subroutes)
                    flattenRoutes(
                        acc,
                        root + path,
                        currentConnectedActions,
                        localComponents,
                        route.subroutes,
                    )
            } else {
                acc[root + path] = route as string
            }
            return acc
        }, initialRoutes)
    }

    /* 
     * Take in the routing configuration and create component hierarchy
     * from it.
     *
     * Inject components with:
     * - navigate('Route name', {route: 'params'}) function that allows to
     *   switch to any named route with configurable parameters.
     *
     * - locations object that contains all named routes as functions.
     *   Calling a function with optional parameters will navigate to the
     *   route by that name.
     *
     * - link('Route name', {route: 'params'}) function that returns
     *   a string URL for a given route.
     *
     * Start listening to browser location changes and react by replacing
     * current top component with new component corresponding to the route.
     *
     * Components created by this function will have a chain of outlets
     * if there are any components mentioned in subroutes.
     *
     * Returns a wrapped renderer that is aware of routing.
     */
    const createRouting = (
        { routes, defaultPath = '/', rootPath = '' }: RouterConfig,
        topComponent: Component,
        render: RouteRendererFn,
    ) => {
        const urlMapper = Mapper({ query: true })
        const history = createHistory({ basename: rootPath })

        const flatRoutes = flattenRoutes({}, '', Immutable([]), [], routes)
        const flatRoutesByName = Object.keys(flatRoutes).reduce((acc, path) => {
            const route = flatRoutes[path]
            if (typeof route !== 'string') {
                acc[route.name] = route
            }

            return acc
        }, {})

        setGlobal(appConfig, 'routes', flatRoutes)

        const locations = Object.keys(flatRoutes).reduce(
            (acc: Locations, path) => {
                const route = flatRoutes[path]
                if (typeof route !== 'string') {
                    acc[route.name] = (params: any) => (
                        event = { preventDefault: () => {} },
                    ) => {
                        if (
                            event['preventDefault'] &&
                            typeof event['preventDefault'] === 'function'
                        )
                            event.preventDefault()
                        history.push(
                            urlMapper.stringify(path, params || {}),
                            {},
                        )
                    }
                }
                return acc
            },
            {},
        )

        const link = (name: string, params: { [key: string]: any }) => {
            const route = flatRoutesByName[name]
            if (route)
                return rootPath + urlMapper.stringify(route.path, params || {})
        }

        const navigate = (name: string, params: { [key: string]: any }) => {
            const route = locations[name]
            if (route) return route(params)
        }

        setGlobal(appConfig, 'navigate', navigate)

        /*
         * Create a chain of components based on routing configuration.
         * Each component will have an instance of the next component in routing
         * path as its outlet (available as outlet() in render function).
         */
        const chainComponents = (
            current: Component,
            rest: Component[],
        ): ComponentInstance => {
            const nextComponent = rest.shift()
            if (nextComponent) {
                return instantiateComponent(
                    current,
                    chainComponents(nextComponent, rest),
                    { locations, navigate, link },
                )
            }
            return instantiateComponent(current, () => undefined, {
                link,
                locations,
                navigate,
            })
        }

        /*
         * Router state is stored in global store. But it is read only.
         * Manual changes to routing state will not automatically change
         * current route. Component's render function has access to navigate()
         * and locations for that.
         */
        const updateRouterModel = (route: FlatRoute, params: any) => {
            log(appConfig, 'UPDATE: Router model')
            updateStream((model) =>
                model.setIn(['$router', 'current'], {
                    name: route.name,
                    params: params,
                }),
            )
        }

        // Contains routes with already instantiated component chain.
        // We don't need to recreate component instances on every route
        // change. All variance is in the model.
        const routeCache = {}

        // Remember last route and it's parameters
        let lastRoute: Route
        let lastValuesJSON: string
        const isNewRoute = (name, values) =>
            !lastRoute || lastRoute.name !== name || lastValuesJSON !== values

        /*
         * Activate route by given path.
         *
         * If route is rendered for the first time we will create and cache
         * a new component chain based on route configuration.
         *
         * If the route is found in the cache, we simply reuse the old
         * component chain.
         *
         * If current route path or parameters are different from the last
         * call to navigateByPath, we update the $router field in global
         * state and execute all actions associated with the route.
         *
         * This will automatically trigger re-render because we at least
         * add new update functino while changing $router state.
         *
         * Returns current component chain if the path was resolved to a new
         * route and the route is different from previously rendered one.
         * Otherwise returns undefined.
         *
         */
        const navigateByPath = (path: string): undefined | RenderFn => {
            const resolved = urlMapper.map(path, flatRoutes)
            if (!resolved) {
                const wildcardRoute = flatRoutes['*']
                if (typeof wildcardRoute === 'string')
                    history.push(wildcardRoute, {})
                return
            }

            const route = resolved.match
            const valuesJSON = JSON.stringify(resolved.values)

            // Redirect
            if (typeof route === 'string') {
                history.push(route, {})
                return
            }

            if (!routeCache[route.name]) {
                routeCache[route.name] = chainComponents(
                    topComponent,
                    route.components.slice(0),
                )
            }

            const chain = routeCache[route.name]

            if (isNewRoute(route.name, valuesJSON)) {
                lastRoute = route
                lastValuesJSON = valuesJSON
                setTimeout(() => {
                    route.connectedActions.forEach((action: Action) => {
                        log(
                            appConfig,
                            'UPDATE: Route action for',
                            route.name,
                            route.path,
                        )
                        action(resolved.values)
                    })
                    updateRouterModel(route, resolved.values)
                })
            }
            return chain
        }

        history.listen((location, action) => {
            const path = location.pathname + location.search
            navigateByPath(path)
        })

        return () => {
            const path = history.location.pathname + history.location.search
            const chain = navigateByPath(path)
            if (chain)
                setTimeout(() => {
                    log(appConfig, 'RENDER: --')
                    render(chain)
                })
        }
    }

    /*
     * Starts the Aludel application
     *
     * If routes object was passed it will generate routes and start listening
     * to browser location.
     *
     * Otherwise it will simply render topComponent.
     *
     */
    const start = (
        rootElement: HTMLElement,
        topComponent: Component,
        routerConfig?: RouterConfig,
    ) => {
        if (routerConfig) {
            const routingRenderer = createRouting(
                routerConfig,
                topComponent,
                (instance: ComponentInstance) =>
                    renderer(rootElement, instance),
            )
            modelStream.map((model) => {
                setGlobal(appConfig, 'model', model)
                routingRenderer()
            })
        } else {
            const topInstance = instantiateComponent(
                topComponent,
                () => undefined,
                {
                    navigate: () => {},
                    link: () => undefined,
                    locations: {},
                },
            )
            modelStream.map((model) => {
                setGlobal(appConfig, 'model', model)
                setTimeout(() => {
                    log(appConfig, 'RENDER: --')
                    renderer(rootElement, topInstance)
                })
            })
        }
    }

    return start
}
