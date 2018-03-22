import { createContext, Model } from './context'
import { Component, Instance, createInstance } from './component'
import { RouteMap } from './router'

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

export function createRoutedApp(
    initialModel: Model,
    routes: RouteMap,
    render: (instance: Instance) => void,
): () => void {
    let topInstance: Instance = () => {}

    return () => {
    }
}
