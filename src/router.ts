import Mapper from 'url-mapper'
import createBrowserHistory from 'history/createBrowserHistory'
import createMemoryHistory from 'history/createMemoryHistory'
import History from 'history'
import {
    Component,
    Instance,
    createInstance,
    Action,
    ActionMap,
} from './component'
import { Context, ConnectedActionMap } from './context'
import { layoutComponent } from '../demo/components/layout'

// A map of navigation functions (changes browser URL)
export type NavigateMap = {
    [key: string]: (params?: { [key: string]: any }) => void
}
// A map of link creation functions (returns valid URL for giving route)
export type LinkMap = {
    [key: string]: (params?: { [key: string]: any }) => string
}

// Router configuration
export type RouterConfig = {
    routes: RouteMap
    mountPoint?: string
    layoutComponent?: Component
}

// Router object
export type Router = {
    flatRoutes: FlatRouteMap // Flattened routing tree
    navigate: NavigateMap // Functions that change Browser state (URL)
    setRoute: ConnectedActionMap // Actions that change App state ($app)
    link: LinkMap // Functions that return parametrized URL for route
    history: History.History // Browser history
    start: () => void // Starts listening to browser history
}

// Initial route configuration with possible subroutes
export type Route = {
    name: string
    component: Component
    subroutes?: RouteMap
    action?: Action
}

// Initial routing tree
export type RouteMap = { [key: string]: Route | string }

// Flattened route
export type FlatRoute = {
    name: string
    path: string
    componentChain: Component[]
    actionChain: Action[]
}

// A map of flattened routes
export type FlatRouteMap = { [key: string]: FlatRoute | string }

/*
 * Flattens routing tree by chaining paths, components and actions.
 * 
 */
function flattenRoutes(
    flatRoutes: FlatRouteMap,
    namePool: string[],
    pathPool: string[],
    parentPath: string,
    componentChain: Component[],
    actionChain: Action[],
    routes: RouteMap,
): FlatRouteMap {
    return Object.keys(routes).reduce((acc, path) => {
        const route = routes[path]
        let flatRoute

        if (typeof route === 'string') {
            flatRoutes[parentPath + path] = route
        } else {
            flatRoute = {
                name: route.name,
                path:
                    parentPath === '/' && path.startsWith('/')
                        ? path
                        : parentPath + path,
                componentChain: [...componentChain, route.component],
                actionChain: [...actionChain, route.action],
            }

            if (!flatRoute.path.startsWith('/'))
                throw new Error(
                    `Route with name ${
                        flatRoute.name
                    } does not start with slash`,
                )
            if (namePool.includes(flatRoute.name))
                throw new Error(
                    `Route with name ${flatRoute.name} is already defined`,
                )
            if (pathPool.includes(flatRoute.path))
                throw new Error(
                    `Route with path ${flatRoute.path} is already defined`,
                )

            namePool.push(flatRoute.name)
            pathPool.push(flatRoute.path)

            flatRoutes[flatRoute.path] = flatRoute
            if (route.subroutes)
                return flattenRoutes(
                    flatRoutes,
                    namePool,
                    pathPool,
                    flatRoute.path,
                    flatRoute.componentChain,
                    flatRoute.actionChain,
                    route.subroutes,
                )
        }
        return flatRoutes
    }, {})
}

/*
 * Creates navigation functions for all flat routes.
 */
function createNavigation(
    urlMapper,
    browserHistory,
    flatRoutes: FlatRouteMap,
): NavigateMap {
    return Object.keys(flatRoutes).reduce((acc, path) => {
        const route = flatRoutes[path]

        // Don't generate navigation for redirects
        if (typeof route === 'string') return acc

        acc[route.name] = (params?) => {
            browserHistory.push(urlMapper.stringify(path, params || {}), {})
        }

        return acc
    }, {})
}

/*
 * Creates actions that set $app.route and $app.instance values in global
 * state.
 *
 * Expects local model to have 'route' and 'instance' fields respectively.
 *
 */
function createRouteSetters(
    context: Context,
    flatRoutes: FlatRouteMap,
    navigate: NavigateMap,
    link: LinkMap,
): ConnectedActionMap {
    // Create Actions
    const actions = Object.keys(flatRoutes).reduce((acc, path) => {
        const route = flatRoutes[path]

        // Don't process redirects
        if (typeof route === 'string') return acc

        acc[route.name] = params => model => {
            const instanceChain = instantiateChain(
                context,
                route.componentChain,
                navigate,
                link,
            )
            const lastIndex = route.componentChain.length - 1
            const actionName = `${route.name} (${
                route.componentChain[lastIndex].signature
            })`
            if (route.actionChain[lastIndex]) {
                const routeAction = context.connectActions(
                    route.componentChain[lastIndex].paths,
                    {},
                    {
                        [actionName]: route.actionChain[lastIndex],
                    },
                    'Router',
                )
                routeAction[actionName](params)
            }
            model.route = {
                name: route.name,
                path: route.path,
                params: params || {},
            }
            model.instance = instanceChain
            return model
        }

        return acc
    }, {})

    return context.connectActions(
        { route: ['$app', 'route'], instance: ['$app', 'instance'] },
        {},
        actions,
        'Router',
    )
}

/*
 * Create a chain of instances where each next instance is put in an outlet of
 * current instance.
 *
 * Last instance gets an empty outlet.
 *
 * createInstance will reuse cached instances when possible, so this operation
 * should be fast.
 *
 */
function instantiateChain(
    context: Context,
    chain: Component[],
    navigate,
    link,
): Instance {
    if (chain.length === 0) return (props: any) => {}

    const [currentInstance, ...rest] = chain

    return (props: any) =>
        createInstance(context, currentInstance, { navigate, link })(
            props,
            instantiateChain(context, rest, navigate, link),
        )
}

/*
 * Create link generators for each flat route
 *
 */
function createLink(urlMapper, flatRoutes: FlatRouteMap): LinkMap {
    return Object.keys(flatRoutes).reduce((acc, path) => {
        const route = flatRoutes[path]

        // Don't process redirects
        if (typeof route === 'string') return acc

        acc[route.name] = (params = {}) => urlMapper.stringify(path, params)

        return acc
    }, {})
}

/*
 * Creates the Router from given configuration.
 * 
 * Flattens the routing tree.
 * Creates navigation, link creation and route switching actions for each flat route.
 * Exposes history API
 * Exposes start() function that begins browser history tracking
 * 
 */
export function createRouter(
    context: Context,
    routerConfig: RouterConfig,
): Router {
    const urlMapper = Mapper({ query: true })
    // We need this check for Node compatibility
    const browserHistory =
        typeof window !== 'undefined'
            ? createBrowserHistory({ basename: routerConfig.mountPoint })
            : createMemoryHistory({})

    const flatRoutes = flattenRoutes(
        {},
        [],
        [],
        '',
        [],
        [],
        routerConfig.routes,
    )

    const layoutComponent = routerConfig.layoutComponent
    if (layoutComponent) {
        Object.keys(flatRoutes).forEach(path => {
            const flatRoute = flatRoutes[path]
            // Don't process redirects
            if (typeof flatRoute === 'string') return

            flatRoute.componentChain.unshift(layoutComponent)
            flatRoute.actionChain.unshift(undefined)
        })
    }

    const navigate = createNavigation(urlMapper, browserHistory, flatRoutes)
    const link = createLink(urlMapper, flatRoutes)
    const setRoute = createRouteSetters(context, flatRoutes, navigate, link)

    return {
        flatRoutes,
        navigate,
        setRoute,
        link,
        history: browserHistory,
        start: () => {
            browserHistory.listen((location, action) => {
                const path = location.pathname + location.search
                const matchedRoute = urlMapper.map(path, flatRoutes)

                if (matchedRoute) {
                    if (typeof matchedRoute.match === 'string') {
                        browserHistory.push(matchedRoute.match, {})
                    } else {
                        setRoute[matchedRoute.match.name](matchedRoute.values)
                    }
                } else {
                    const wildCardRoute = flatRoutes['*']
                    if (typeof wildCardRoute === 'string')
                        browserHistory.push(wildCardRoute, {})
                }
            })
            browserHistory.push(
                browserHistory.location.pathname +
                    browserHistory.location.search,
            )
        },
    }
}
