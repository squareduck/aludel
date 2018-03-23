import { createContext, Model } from './context'
import { Component, Instance, createInstance } from './component'
import { RouteMap, createRouter } from './router'

/*
 * Create Aludel application.
 *
 * Application automatically creates context and reserves the key '$app' in
 * global state for it's own use.
 *
 * It also creates actions to manage that portion of the state. So in a way it
 * behaves like a meta-component.
 *
 * The most important action is 'setInstance' it will update the current
 * component instance that is being rendered. This instance will be stored
 * in '$app.instance' in global state.
 *
 * setInstance is immediately called with the instance created from
 * topComponent.
 *
 * Be warned - local model returned from action is treated as promise before
 * being applied back to global state. That means actual rendering will happen
 * only on the next tick of event loop.
 *
 */
export function createApp(
    initialModel: Model,
    topComponent: Component,
    render: (instance: Instance) => void,
): () => void {
    initialModel['$app'] = {
        instance: () => {}
    }

    return () => {
        const context = createContext(initialModel, (state) => {
            render(state['$app']['instance'])
        })

        const actions = context.connectActions({instance: ['$app','instance']}, {
            setInstance: (instance) => (model) => {
                model.instance = instance
                return model
            }
        })

        actions.setInstance(createInstance(context, topComponent))
    }
}

/*
 * Create a routed Aludel application.
 *
 * All comments from createApp still apply. But now we have a few additions.
 *
 * Routing tree is flattened and for each flat route we create a navigate
 * action and a setRoute action.
 *
 * navigate action changes the browser state (URL).
 * setRoute action changes $app.route state and puts proper component instance
 * chain into $app.instance.
 *
 * We listen to browser state changes and call setRoute if URL matches one of
 * defined routes.
 *
 * Component instance chains are cached after first use. We can do that because
 * the only dynamic place in our app is global state.
 *
 * So changing route can happen in two paths:
 * - Browser state changed by user -> setRoute action is triggered
 * - Navigate action changes browser state -> setRoute action is triggered
 *
 */
export type RouterConfig = {
    routes: RouteMap,
    layoutComponent?: Component,
}

export function createRoutedApp(
    initialModel: Model,
    routerConfig: RouterConfig,
    render: (instance: Instance) => void,
): () => void {
    initialModel['$app'] = {
        instance: () => {},
        route: {}
    }


    return () => {
        const context = createContext(initialModel, (state) => {
            render(state['$app']['instance'])
        })

        const router = createRouter(context, routerConfig.routes, routerConfig.layoutComponent)
        router.start()

        const root = router.flatRoutes['/']
        if (!root) throw new Error('Root route "/" was not found in routes.')
        router.navigate[root.name]()
    }
}
