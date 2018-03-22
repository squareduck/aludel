import Mapper from 'url-mapper'
import createBrowserHistory from 'history/createBrowserHistory'
import createMemoryHistory from 'history/createMemoryHistory'
import {
    Component,
    Instance,
    createInstance,
    Action,
    ActionMap,
} from './component'
import { Context, ConnectedActionMap } from './context'

export type NavigateMap = {
    [key: string]: (params: { [key: string]: any }) => void
}

export type Router = {
    flatRoutes: FlatRouteMap
    navigate: NavigateMap // Actions that change Browser state (URL)
    setRoute: ConnectedActionMap // Actions that change App state ($app)
    start: () => void // Starts listening to browser history
}

export type Route = {
    name: string
    component: Component
    subroutes?: RouteMap
    action?: Action
}

export type RouteMap = { [key: string]: Route }

export type FlatRoute = {
    name: string
    path: string
    componentChain: Component[]
    actionChain: Action[]
}

export type FlatRouteMap = { [key: string]: FlatRoute }

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
        const flatRoute = {
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

        acc[route.name] = params => {
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
): ConnectedActionMap {
    // Create Actions
    const actions = Object.keys(flatRoutes).reduce((acc, path) => {
        const route = flatRoutes[path]

        acc[route.name] = params => model => {
            model.route = {
                name: route.name,
                path: route.path,
                params: params || {},
            }
            model.instance = instantiateChain(context, route.componentChain)
            return model
        }

        return acc
    }, {})

    return context.connectActions(
        { route: ['$app', 'route'], instance: ['$app', 'instance'] },
        actions,
    )
}

function instantiateChain(context: Context, chain: Component[]): Instance {
    let lastInstance = () => {}
    for (let i = chain.length - 1; i >= 0; i--) {
        lastInstance = createInstance(context, chain[i], lastInstance)
    }

    return lastInstance
}

/*
 * Flattens the routing tree.
 * Creates a navigation and route actions for each flat route.
 *
 */
export function createRouter(context: Context, routes: RouteMap): Router {
    const urlMapper = Mapper({ query: true })
    const browserHistory =
        typeof window !== 'undefined'
            ? createBrowserHistory()
            : createMemoryHistory()

    const flatRoutes = flattenRoutes({}, [], [], '', [], [], routes)
    const navigate = createNavigation(urlMapper, browserHistory, flatRoutes)
    const setRoute = createRouteSetters(context, flatRoutes)

    return {
        flatRoutes,
        navigate,
        setRoute,
        start: () => {
            browserHistory.listen((location, action) => {
                const path = location.pathname + location.search
                const matchedRoute = urlMapper.map(path, flatRoutes)

                if (matchedRoute) {
                    setRoute[matchedRoute.match.name](matchedRoute.values)
                }
            })
        },
    }
}
