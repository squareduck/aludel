import flyd from 'flyd'
import * as R from 'ramda'

export type Model = {[key: string]: any}
export type UpdateFn = (model: Model) => Model
export type RendererFn = (rootElement: HTMLElement, view: any) => any

export type Component = () => (tools: ViewTools) => any
export type SocketPaths = {[key: string]: string[]}
export type ComponentLenses = {[key: string]: R.Lens}
export type ComponentFoci = {[key: string]: any}
export type ComponentActions = {[key: string]: (...args: any[]) => UpdateFn} 

export interface ComponentTemplate {
    sockets: string[]
    actions: (tools: ActionTools) => ComponentActions
    view: (tools: ViewTools) => any
}

export interface ActionTools {
    foci: ComponentFoci
    lenses: ComponentLenses
}

export interface ViewTools {
    createComponent: Function
    foci: ComponentFoci
    actions: ComponentActions
}


export const createApp = (initialModel: Model, renderer: RendererFn) => {
    const updateStream = flyd.stream<UpdateFn>()

    const applyUpdate = (currentModel: Model, modelUpdate: UpdateFn) => modelUpdate(currentModel)
    const modelStream = flyd.scan<Model, UpdateFn>(applyUpdate, initialModel, updateStream)

    let topComponent = () => ({})

    const createComponent = (template: ComponentTemplate, paths: SocketPaths): Component => {

        const lenses = R.reduce<string, ComponentLenses>(
            (acc, socket) => R.assoc(socket, R.lensPath(paths[socket]), acc),
            {},
            template.sockets
        )

        const foci   = R.reduce<string, ComponentFoci>(
            (acc, socket) => R.assoc(socket, () => R.view(lenses[socket], modelStream()), acc),
            {},
            template.sockets
        )

        const actionMap = template.actions({foci, lenses})
        const actions = R.reduce<string, ComponentActions>(
            (acc, action) => R.assoc(action, (...args: any[]) => updateStream(actionMap[action](...args)), acc),
            {},
            R.keys(actionMap)
        )

        return () => template.view({createComponent, foci, actions})
    }

    const start = (rootElement: HTMLElement, component?: Component) => {
        if (component) {
            topComponent = () => component
        }

        modelStream.map(model => {
            console.log(model)
            renderer(rootElement, topComponent())
        })
    }

    return {
        createComponent,
        start,
        focus,
    }
}
