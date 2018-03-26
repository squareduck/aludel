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

export type NavigateMap = {
    [key: string]: (params?: { [key: string]: any }) => void
}
export type LinkMap = {
    [key: string]: (params?: { [key: string]: any }) => string
}

export type Router = {
    flatRoutes: FlatRouteMap
    navigate: NavigateMap // Functions that change Browser state (URL)
    setRoute: ConnectedActionMap // Actions that change App state ($app)
    link: LinkMap // Functions that return parametrized URL for route
    history: History.History // Browser history
    start: () => void // Starts listening to browser history
}

export type Route = {
    name: string
    component: Component
    subroutes?: RouteMap
    action?: Action
}

export type RouteMap = { [key: string]: Route | string }

export type FlatRoute = {
    name: string
    path: string
    componentChain: Component[]
    actionChain: Action[]
}

export type FlatRouteMap = { [key: string]: FlatRoute | string }

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
                    } path does not start with slash.`,
                )
            if (namePool.includes(flatRoute.name))
                throw new Error(
                    `Route with name ${flatRoute.name} is already used.`,
                )
            if (pathPool.includes(flatRoute.path))
                throw new Error(
                    `Route with path ${flatRoute.path} is already used.`,
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
            const lastIndex = route.componentChain.length - 1
            if (route.actionChain[lastIndex]) {
                const routeAction = context.connectActions(
                    route.componentChain[lastIndex].paths,
                    {
                        action: route.actionChain[lastIndex],
                    },
                )
                routeAction.action()
            }
            model.route = {
                name: route.name,
                path: route.path,
                params: params || {},
            }
            model.instance = instantiateChain(
                context,
                route.componentChain,
                navigate,
                link,
            )
            return model
        }

        return acc
    }, {})

    return context.connectActions(
        { route: ['$app', 'route'], instance: ['$app', 'instance'] },
        actions,
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
    chain = chain.slice(0)
    if (chain.length > 0) {
        return (props: any) =>
            createInstance(context, chain.shift(), { navigate, link })(
                props,
                instantiateChain(context, chain, navigate, link),
            )
    }

    return (props: any) => {}
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
 * Flattens the routing tree.
 * Creates a navigation and route actions for each flat route.
 *
 */
export function createRouter(
    context: Context,
    routes: RouteMap,
    layoutComponent?: Component,
): Router {
    const urlMapper = Mapper({ query: true })
    // We need this check for Node compatibility
    const browserHistory =
        typeof window !== 'undefined'
            ? createBrowserHistory()
            : createMemoryHistory()

    const flatRoutes = flattenRoutes({}, [], [], '', [], [], routes)

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
        },
    }
}
