import flyd from 'flyd'
import Immutable from 'seamless-immutable'
import Mapper from 'url-mapper'
import hash from 'object-hash'
import createHistory from 'history/createBrowserHistory'

/*
 * App
 */

export type StartFn = (
    rootElement: HTMLElement,
    topComponent: Component,
    routes?: RouteMap,
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

export type Action = (...args: any[]) => UpdateFn | Promise<UpdateFn>
export type ActionMap = { [key: string]: Action }

// Wrapper around Action that will call the action with local model and sync
// results back into global state.
//
// All of the above will be wrapped into UpdateFn and passed to UpdateStream
export type ConnectedAction = (...args: any[]) => void

export type RenderFn = (tools: RenderTools) => any

export interface ComponentTemplateMutable {
    sockets: string[] // socket name
    actions: ActionMap
    children: { [key: string]: Component }
    render: RenderFn
}
export type ComponentTemplate = Immutable.ImmutableObject<
    ComponentTemplateMutable
>

export type SocketMap = { [key: string]: string[] }

export interface ComponentMutable {
    name?: string
    signature: string // unique hash of component template + paths
    template: ComponentTemplate
    paths: SocketMap
}
export type Component = Immutable.ImmutableObject<ComponentMutable>

export type ComponentInstance = (props: Props) => any
export type Props = { [key: string]: any }

export interface RenderTools {
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

// Routing tree that will be passed to the app
export type RouteMap = { [key: string]: Route | string }
export interface Route {
    name: string
    component: Component
    action?: Action
    subroutes?: RouteMap
}

// Route converted from initial routing tree with all subroutes flattened
export interface FlatRoute {
    path: string
    name: string
    cache?: ComponentInstance
    components: Component[]
    connectedActions: Immutable.ImmutableArray<ConnectedAction>
}

export type FlatRouteMap = { [key: string]: FlatRoute | string }
export interface FlatRouteCache {
    instance: ComponentInstance
}

export type Locations = { [key: string]: Function }
export type LinkFn = (name: string, params: any) => string
export type NavigateFn = (name: string, params: any) => void
export interface RouterConfig {
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
 * Returns immutable object.
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

    return Immutable(defaults)
}

/*
 * Create component from template and path.
 *
 * This function automatically generates a unique signature for component.
 * A new socket named '$local' is added, and a new path for this socket is
 * created leading to ['$local', <signature>]. This allows each component to
 * have 'local' state.
 *
 * Returns immutable object.
 */
export const createComponent = (
    template: ComponentTemplate,
    paths: SocketMap,
    name?: string,
): Component => {
    const signature = hash({ template, paths })
    // Check for any sockets with undefined paths
    template.sockets.forEach((socket) => {
        if (!paths[socket])
            console.error(
                `ERROR: No path defined for socket "${socket}" in component "${name ||
                    signature}"`,
            )
    })
    paths['$local'] = ['$local', signature]
    return Immutable({
        name: name,
        signature,
        template: template.set('sockets', template.sockets.concat(['$local'])),
        paths,
    })
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
): StartFn => {
    window.Aludel = {}

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
    ) =>
        sockets.reduce((acc, socket) => {
            if (paths[socket]) return acc.setIn(paths[socket], local[socket])
            return acc
        }, global)

    /*
     * Link raw action with updateStream of current app.
     * 
     * Handle promises if needed.
     *
     */
    const connectAction = (
        action: Action,
        sockets: string[],
        paths: SocketMap,
    ): ConnectedAction => (...args) => {
        const update = action(...args)
        Promise.resolve(update)
            .then((resolvedUpdate) =>
                resolvedUpdate(localModel(sockets, paths)),
            )
            .then((newModel) =>
                updateStream(syncModel(newModel, sockets, paths)),
            )
    }

    /*
     * Create a "renderer-ready" function from component
     */
    const instantiateComponent = (
        { name, template, paths, signature }: Component,
        outlet: ComponentInstance,
        routerConfig: RouterConfig,
    ): ComponentInstance => {
        console.log('CREATE: Component instance', name || signature)
        /*
         * Actions should be executed against local model and their
         * result should be synchronised back into global state.
         */
        const actions = Object.keys(template.actions).reduce(
            (acc, action) => {
                acc[action] = connectAction(
                    template.actions[action],
                    template.sockets,
                    paths,
                )
                return acc
            },
            {} as any,
        )

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
                props: props,
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
     * - TODO: link('Route name', {route: 'params'}) function that returns
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
        routes: RouteMap,
        topComponent: Component,
        render: RouteRendererFn,
    ) => {
        const urlMapper = Mapper({ query: true })
        const history = createHistory()

        const flatRoutes = flattenRoutes({}, '', Immutable([]), [], routes)
        const flatRoutesByName = Object.keys(flatRoutes).reduce((acc, path) => {
            const route = flatRoutes[path]
            if (typeof route !== 'string') {
                acc[route.name] = route
            }

            return acc
        }, {})

        window.Aludel.routes = flatRoutes

        const locations = Object.keys(flatRoutes).reduce(
            (acc: Locations, path) => {
                const route = flatRoutes[path]
                if (typeof route !== 'string') {
                    acc[route.name] = (params: any) => () =>
                        history.push(
                            '/#' + urlMapper.stringify(path, params || {}),
                            {},
                        )
                }
                return acc
            },
            {},
        )

        const link = (name: string, params: { [key: string]: any }) => {
            const route = flatRoutesByName[name]
            if (route)
                return '/#' + urlMapper.stringify(route.path, params || {})
        }

        const navigate = (name: string, params: { [key: string]: any }) => {
            const route = locations[name]
            if (route) return route(params)
        }

        window.Aludel.navigate = navigate

        let lastRoute: Route
        let lastValues: string

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
            console.log('UPDATE: Router model')
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

        /*
         * Render route by given path.
         *
         * If route is rendered for the first time we will create a new
         * component chain based on route configuration. Then we put it
         * in the cache.
         *
         * If the route is found in the cache, we simply reuse the old
         * component chain.
         *
         * If current route path or parameters are different from the last
         * call to navigateByPath, we update the $router field in global
         * state and execute all actions associated with the route.
         *
         * If 'force' parameter is set to true we rerender components
         * even if the route didn't chance since last time.
         *
         */
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
                        routeCache[route.name] = chainComponents(
                            topComponent,
                            route.components.slice(0),
                        )
                    }
                    cachedRoute = routeCache[route.name]
                    if (
                        (lastRoute && route.name !== lastRoute.name) ||
                        lastValues !== valuesString
                    ) {
                        lastRoute = route
                        lastValues = valuesString
                        route.connectedActions.forEach((action: Action) => {
                            console.log('UPDATE: Route action for', route.name)
                            action(resolved.values)
                        })
                        updateRouterModel(route, resolved.values)
                        console.log(`RENDER: ${route.name} (${path})`)
                        setTimeout(() => render(cachedRoute))
                    } else if (force) {
                        console.log('RENDER: --')
                        setTimeout(() => render(cachedRoute))
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

        return (force: boolean) =>
            navigateByPath(history.location.hash.substring(1), force)
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
        routes?: RouteMap,
    ) => {
        if (routes) {
            const routingRenderer = createRouting(
                routes,
                topComponent,
                (instance: ComponentInstance) =>
                    renderer(rootElement, instance),
            )
            modelStream.map((model) => {
                window.Aludel.model = model
                routingRenderer(true)
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
                window.Aludel.model = model
                renderer(rootElement, topInstance)
            })
        }
    }

    return start
}
