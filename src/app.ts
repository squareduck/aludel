import { createContext, Model } from './context'
import { Component, Instance, createInstance } from './component'

/*
 * Create Aludel application.
 *
 * Automatically creates context and top component instance.
 *
 */
export function createApp(
    initialModel: Model,
    topComponent: Component,
    render: (instance: Instance) => void,
): () => void {
    let topInstance: Instance = () => {}

    return () => {
        const context = createContext(initialModel, () => {
            render(topInstance)
        })

        topInstance = createInstance(context, topComponent)

        render(topInstance)
    }
}
