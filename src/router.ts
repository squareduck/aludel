import { Component, createInstance, ActionMap } from './component'
import { Context } from './context'

/*
 * # Routing
 *
 * Routing is state management with sideeffects.
 *
 * We manage it as if Router was a component. But it has a unique side effect:
 * - Changes URL in browser
 * - Replaces rendered component tree with instantiated tree from route
 *
 *
 * As with any action we will rerender top component. But route action can
 * change what this component is.
 *
 * Also, components in routes have access to 'outlet()' function. This function
 * represents an instance of the next component in subroutes.
 */

export type Route = {
    name: string
    component: Component
    subroutes?: RouteMap
}

export type RouteMap = { [key: string]: Route }

/*
 * Creates a navigation action for each flat route.
 *
 * Flat routes are constructed by flattening subroutes.
 *
 */
function createRouter(context: Context, routes: RouteMap): ActionMap {
    return Object.keys(routes).reduce((acc, path) => {
        const route = routes[path]
        acc[route.name] = () => (model) => {
            model.path = path
            model.name = route.name
            model.instance = createInstance(context, route.component)
            return model
        }
        return acc
    }, {})
}
